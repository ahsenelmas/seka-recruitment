<?php

namespace App\Http\Controllers;

use App\Models\ApplicationMessage;
use App\Models\Candidate;
use App\Support\P01;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class SendReplyController extends Controller
{
    public function __invoke(Request $r, string $id, string $message)
    {
        abort_unless(P01::allows('correspondence.send'), 403);
        abort_unless(config('p01.mail_enabled') && config('mail.default') === 'smtp', 503, 'Real SMTP delivery is disabled.');
        $d = $r->validate(['version' => ['required', 'integer'], 'confirmed' => ['required', 'accepted'], 'purpose_code' => ['nullable', 'string', 'max:50']]);
        if (! empty($d['purpose_code'])) {
            abort_unless(DB::table('recruitment_dictionaries')->where('kind', 'purpose')->where('code', $d['purpose_code'])->where('is_active', true)->exists(), 422);
        }
        [$c,$m] = DB::transaction(function () use ($id, $message, $d) {
            $c = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            $m = ApplicationMessage::whereKey($message)->where('candidate_id', $id)->lockForUpdate()->firstOrFail();
            abort_unless($m->direction === 'outbound' && $m->delivery_status === 'draft' && $m->version === (int) $d['version'], 409, 'Only an unchanged draft can be sent.');
            abort_unless(filter_var($c->email, FILTER_VALIDATE_EMAIL), 422);
            $m->delivery_status = 'sending';
            $m->version++;
            $m->save();

            return [$c, $m];
        });
        try {
            Mail::raw($m->body, function ($mail) use ($c, $m) {
                $mail->from('kariera@seka.pl', 'SEKA HR')->replyTo('kariera@seka.pl')->to($c->email)->subject($m->subject.' [SEKA:'.$c->id.']');
            });
        } catch (\Throwable) {
            $m->delivery_status = 'delivery_uncertain';
            $m->save();

            return response()->json(['message' => 'Delivery could not be confirmed. Check the mail provider before trying again. Automatic resend is disabled.'], 502);
        }
        DB::transaction(function () use ($c, $m, $d) {
            $m->delivery_status = 'sent';
            $m->save();
            DB::table('application_contacts')->insert(P01::base($c) + ['event_code' => 'email_sent', 'message_id' => $m->id, 'purpose_code' => $d['purpose_code'] ?? null, 'occurred_at' => now(), 'origin' => 'email']);
            P01::record($c, 'email_sent', ['message_id' => $m->id]);
        });

        return response()->json(['sent' => true]);
    }
}
