<?php

namespace App\Http\Controllers;

use App\Models\ApplicationMessage;
use App\Models\Candidate;
use App\Support\FileCleanup;
use App\Support\P01;
use App\Support\PdfInspector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class IntakeQueueController extends Controller
{
    private function hr(): void
    {
        abort_unless(P01::allows('intake.create') && request()->attributes->get('seka_demo_scope') === 'all', 403);
    }

    public function ingest(Request $r)
    {
        $key = config('p01.ingest_key');
        abort_unless(is_string($key) && strlen($key) >= 32, 503, 'Mailbox intake is not configured.');
        abort_unless(hash_equals($key, (string) $r->header('X-SEKA-Ingest-Key')), 401);
        $d = $r->validate(['message_id' => ['required', 'string', 'max:255'], 'sender' => ['required', 'email', 'max:254'], 'subject' => ['required', 'string', 'max:255'], 'body' => ['required', 'string', 'max:20000'], 'attachments' => ['sometimes', 'array', 'max:5'], 'attachments.*.filename' => ['required', 'string', 'max:200'], 'attachments.*.base64' => ['required', 'string', 'max:7000000']]);
        $fingerprint = hash('sha256', json_encode($d, JSON_THROW_ON_ERROR));
        $existing = DB::table('intake_envelopes')->where('provider_message_id', $d['message_id'])->first();
        if ($existing) {
            abort_unless($existing->fingerprint === $fingerprint, 409, 'Message identifier reused with different content.');

            return response()->json(['id' => $existing->id, 'duplicate' => true]);
        }
        $paths = [];
        try {
            $id = DB::transaction(function () use ($d, $fingerprint, &$paths) {
                $id = DB::table('intake_envelopes')->insertGetId(['provider_message_id' => $d['message_id'], 'fingerprint' => $fingerprint, 'sender' => mb_strtolower($d['sender']), 'subject' => $d['subject'], 'body' => $d['body'], 'created_at' => now(), 'updated_at' => now()]);
                $total = 0;
                foreach (($d['attachments'] ?? []) as $file) {
                    $bytes = base64_decode($file['base64'], true);
                    abort_unless($bytes !== false && strlen($bytes) <= 5 * 1024 * 1024, 422, 'Invalid attachment or attachment over 5 MB.');
                    $total += strlen($bytes);
                    abort_if($total > 15 * 1024 * 1024, 422, 'Attachment total exceeds 15 MB.');
                    $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
                    $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;
                    abort_unless($ext, 422, 'Only PDF, JPG and PNG are supported.');
                    $path = 'attachments/'.Str::uuid().'.'.$ext;
                    $paths[] = $path;
                    abort_unless(Storage::disk('local')->put($path, $bytes), 500);
                    DB::table('application_attachments')->insert(['envelope_id' => $id, 'storage_key' => $path, 'filename' => mb_substr(basename(str_replace('\\', '/', $file['filename'])), 0, 200), 'mime' => $mime, 'size' => strlen($bytes), 'created_at' => now(), 'updated_at' => now()]);
                }

                return $id;
            });
        } catch (\Throwable $e) {
            foreach ($paths as $p) {
                Storage::disk('local')->delete($p);
            }throw $e;
        }

        // No automatic spam verdict is invented; pending queue remains outside application records.
        return response()->json(['id' => $id, 'classification' => 'pending', 'duplicate' => false], 201);
    }

    public function index()
    {
        $this->hr();

        return response()->json(DB::table('intake_envelopes')->whereIn('classification', ['pending', 'spam'])->orderByDesc('id')->paginate(20));
    }

    public function show(string $id)
    {
        $this->hr();
        $e = DB::table('intake_envelopes')->where('id', $id)->first();
        abort_unless($e, 404);

        return response()->json(['envelope' => $e, 'attachments' => DB::table('application_attachments')->where('envelope_id', $id)->get(['id', 'filename', 'mime', 'size'])]);
    }

    public function classify(Request $r, string $id)
    {
        $this->hr();
        $d = $r->validate(['classification' => ['required', Rule::in(['pending', 'spam'])]]);
        DB::table('intake_envelopes')->where('id', $id)->whereNull('candidate_id')->update($d + ['updated_at' => now()]);

        return response()->json(['updated' => true]);
    }

    public function accept(Request $r, string $id)
    {
        $this->hr();
        $d = $r->validate(['first_name' => ['required', 'string', 'max:100'], 'last_name' => ['required', 'string', 'max:100'], 'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')], 'position' => ['nullable', 'string', 'max:150'], 'reply_to_application' => ['nullable', 'uuid']]);

        return DB::transaction(function () use ($id, $d) {
            $e = DB::table('intake_envelopes')->where('id', $id)->lockForUpdate()->first();
            abort_unless($e, 404);
            if ($e->candidate_id) {
                return response()->json(['id' => $e->candidate_id, 'duplicate' => true]);
            }
            if (! empty($d['reply_to_application'])) {
                $c = Candidate::findOrFail($d['reply_to_application']);
                abort_unless(mb_strtolower($c->email) === mb_strtolower($e->sender), 422, 'Sender does not match this application.');
                ApplicationMessage::create(['candidate_id' => $c->id, 'direction' => 'inbound', 'delivery_status' => 'received', 'sender' => $e->sender, 'recipient' => 'kariera@seka.pl', 'subject' => $e->subject, 'body' => $e->body, 'source' => 'mailbox_import', 'version' => 1]);
            } else {
                $c = Candidate::create(['first_name' => $d['first_name'], 'last_name' => $d['last_name'], 'email' => $e->sender, 'branch_id' => $d['branch_id'] ?? null, 'position' => $d['position'] ?? null, 'status' => 'new_incomplete', 'source' => 'email', 'email_subject' => $e->subject, 'email_body' => $e->body]);
            }
            DB::table('application_attachments')->where('envelope_id', $id)->update(['candidate_id' => $c->id, 'updated_at' => now()]);
            DB::table('intake_envelopes')->where('id', $id)->update(['candidate_id' => $c->id, 'classification' => 'accepted', 'updated_at' => now()]);
            $pdf = DB::table('application_attachments')->where('envelope_id', $id)->where('mime', 'application/pdf')->first();
            if ($pdf && ! $c->cv_storage_key) {
                try {
                    $doc = PdfInspector::document(Storage::disk('local')->path($pdf->storage_key));
                    if (! count($doc->getPages())) {
                        throw new \RuntimeException;
                    }$c->cv_storage_key = $pdf->storage_key;
                    $c->cv_original_filename = $pdf->filename;
                    $c->cv_validation_error = null;
                } catch (\Throwable) {
                    $c->cv_validation_error = 'Imported PDF could not be read. Manual review required.';
                }$c->save();
            }
            if ($c->status === 'new_incomplete' && $c->is_complete) {
                $c->status = 'new_complete';
                $c->save();
            }
            $messageId = ApplicationMessage::where('candidate_id', $c->id)->where('direction', 'inbound')->orderByDesc('created_at')->orderByDesc('id')->value('id');
            DB::table('application_contacts')->updateOrInsert(['candidate_id' => $c->id, 'message_id' => $messageId], P01::base($c) + ['event_code' => 'email_received', 'message_id' => $messageId, 'occurred_at' => $e->created_at, 'origin' => 'email', 'content' => null]);
            P01::record($c, 'mailbox_imported', ['envelope_id' => $e->id]);
            P01::notify($c, 'new_message');

            return response()->json(['id' => $c->id, 'duplicate' => false], 201);
        });
    }

    public function remove(string $id)
    {
        $this->hr();
        DB::transaction(function () use ($id) {
            $e = DB::table('intake_envelopes')->where('id', $id)->lockForUpdate()->first();
            abort_unless($e && ! $e->candidate_id, 409, 'Only unaccepted mail may be deleted here.');
            foreach (DB::table('application_attachments')->where('envelope_id', $id)->get() as $a) {
                DB::table('file_deletions')->insert(['storage_key' => $a->storage_key, 'created_at' => now(), 'updated_at' => now()]);
            }DB::table('intake_envelopes')->where('id', $id)->delete();
        });
        FileCleanup::run();

        return response()->json(['deleted' => true]);
    }

    public function attachment(string $attachment)
    {
        $a = DB::table('application_attachments')->where('id', $attachment)->first();
        abort_unless($a, 404);
        if ($a->candidate_id) {
            Candidate::findOrFail($a->candidate_id);
            abort_unless(P01::allows('cv.view'), 403);
        } else {
            $this->hr();
        }abort_unless(Storage::disk('local')->exists($a->storage_key), 404);

        return Storage::disk('local')->download($a->storage_key, $a->filename, ['Content-Type' => $a->mime, 'X-Content-Type-Options' => 'nosniff']);
    }

    public function manual(Request $r)
    {
        abort_unless(P01::allows('intake.create'), 403);
        $d = $r->validate(['first_name' => ['required', 'string', 'max:100'], 'last_name' => ['required', 'string', 'max:100'], 'email' => ['required', 'email', 'max:254'], 'position' => ['nullable', 'string', 'max:150'], 'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')]]);
        if (request()->attributes->get('seka_demo_scope') === 'branch') {
            abort_unless((int) ($d['branch_id'] ?? 0) === (int) request()->attributes->get('seka_demo_branch_id'), 403);
        }$c = Candidate::create($d + ['status' => 'new_incomplete', 'source' => 'manual']);

        return response()->json($c, 201);
    }

    public function upload(Request $r, string $id)
    {
        abort_unless(P01::allows('cv.upload'), 403);
        $c = Candidate::findOrFail($id);
        $r->validate(['file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120']]);
        $file = $r->file('file');
        $path = $file->store('attachments', 'local');
        abort_unless($path, 500);
        try {
            $row = DB::transaction(function () use ($file, $c, $path) {
                $id = DB::table('application_attachments')->insertGetId(['candidate_id' => $c->id, 'filename' => mb_substr(basename(str_replace('\\', '/', $file->getClientOriginalName())), 0, 200), 'storage_key' => $path, 'mime' => $file->getMimeType(), 'size' => $file->getSize(), 'created_at' => now(), 'updated_at' => now()]);
                P01::record($c, 'attachment_added', ['attachment_id' => $id]);

                return $id;
            });
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }

        return response()->json(['id' => $row], 201);
    }
}
