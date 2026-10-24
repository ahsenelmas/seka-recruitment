<?php

namespace App\Http\Controllers;

use App\Models\ApplicationMessage;
use App\Models\Candidate;
use App\Support\ApplicationMailbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApplicationMailboxController extends Controller
{
    public function inbox(Request $request): JsonResponse
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:200'],
            'filter' => ['nullable', 'in:all,drafts,incomplete'],
            'city' => ['nullable', 'string', 'max:100'],
        ]);
        $query = Candidate::query()->with('branch')->whereHas('messages')
            ->withCount('messages')->withCount(['messages as draft_count' => fn ($q) => $q->where('direction', 'outbound')->where('delivery_status', 'draft')]);
        foreach (['subject' => 'latest_subject', 'updated_at' => 'last_activity_at'] as $column => $alias) {
            $query->addSelect([$alias => ApplicationMessage::select($column)->whereColumn('candidate_id', 'candidates.id')->orderByDesc('updated_at')->orderByDesc('id')->limit(1)]);
        }
        if (! empty($data['search'])) {
            $pattern = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($data['search'])).'%';
            $query->where(fn ($q) => $q->whereLike('first_name', $pattern)->orWhereLike('last_name', $pattern)->orWhereLike('email', $pattern)
                ->orWhereHas('messages', fn ($m) => $m->whereLike('subject', $pattern)));
        }
        if (! empty($data['city'])) $query->whereHas('branch', fn ($q) => $q->where('city', $data['city']));
        if (($data['filter'] ?? '') === 'drafts') $query->whereHas('messages', fn ($q) => $q->where('direction', 'outbound')->where('delivery_status', 'draft'));
        if (($data['filter'] ?? '') === 'incomplete') $query->where(fn ($q) => $q->whereNull('cv_storage_key')->orWhereNotNull('cv_validation_error')->orWhereNull('branch_id')->orWhereNull('position')->orWhereRaw("trim(position) = ''"));
        $page = $query->orderByDesc('last_activity_at')->orderBy('candidates.id')->paginate(20);
        $page->through(fn (Candidate $candidate) => [
            'id' => $candidate->id, 'first_name' => $candidate->first_name, 'last_name' => $candidate->last_name,
            'email' => $candidate->email, 'position' => $candidate->position, 'status' => $candidate->status,
            'branch' => $candidate->branch, 'is_complete' => $candidate->is_complete,
            'latest_subject' => $candidate->latest_subject, 'last_activity_at' => \Illuminate\Support\Carbon::parse($candidate->last_activity_at)->toISOString(),
            'message_count' => $candidate->messages_count, 'draft_count' => $candidate->draft_count,
        ]);
        return response()->json($page);
    }

    public function messages(string $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        return response()->json([
            'candidate' => $candidate->load('branch'), 'mailbox' => ApplicationMailbox::ADDRESS,
            'delivery_connected' => false,
            'messages' => ApplicationMessage::where('candidate_id', $id)->orderByDesc('created_at')->orderByDesc('id')->paginate(20),
        ]);
    }

    private function content(Request $request): array
    {
        return $request->validate([
            'subject' => ['required', 'string', 'max:255'], 'body' => ['required', 'string', 'max:20000'],
            'status' => ['prohibited'], 'from' => ['prohibited'], 'to' => ['prohibited'],
            'sender' => ['prohibited'], 'recipient' => ['prohibited'], 'direction' => ['prohibited'],
            'delivery_status' => ['prohibited'], 'source' => ['prohibited'], 'candidate_id' => ['prohibited'],
        ]);
    }

    public function createDraft(Request $request, string $id): JsonResponse
    {
        $data = $this->content($request);
        $clientId = $request->validate(['client_id' => ['required', 'uuid']])['client_id'];
        $message = DB::transaction(function () use ($id, $data, $clientId) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            // A stable client UUID makes retrying a lost response idempotent.
            $existing = ApplicationMessage::find($clientId);
            if ($existing) {
                abort_unless($existing->candidate_id === $id && $existing->direction === 'outbound' && $existing->delivery_status === 'draft'
                    && $existing->subject === $data['subject'] && $existing->body === $data['body'], 409, 'Draft changed. Reload the conversation.');
                return $existing;
            }
            $message = ApplicationMessage::create($data + [
                'id' => $clientId, 'candidate_id' => $id, 'direction' => 'outbound', 'delivery_status' => 'draft',
                'sender' => ApplicationMailbox::ADDRESS, 'recipient' => $candidate->email, 'source' => 'reply_draft', 'version' => 1,
            ]);
            ApplicationMailbox::record($candidate, 'reply_draft_created', $message);
            return $message;
        });
        return response()->json($message, 201);
    }

    public function updateDraft(Request $request, string $id, string $messageId): JsonResponse
    {
        $data = $this->content($request);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        return response()->json(DB::transaction(function () use ($id, $messageId, $data, $version) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            $message = ApplicationMessage::whereKey($messageId)->where('candidate_id', $id)->lockForUpdate()->firstOrFail();
            abort_unless($message->direction === 'outbound' && $message->delivery_status === 'draft', 409, 'Only drafts can be edited.');
            abort_unless($message->version === (int) $version, 409, 'Another editor changed this draft. Reload before editing.');
            if ($message->subject !== $data['subject'] || $message->body !== $data['body']) {
                $message->fill($data); $message->version = $message->version + 1; $message->save();
                ApplicationMailbox::record($candidate, 'reply_draft_updated', $message);
            }
            return $message;
        }));
    }

    public function sampleIncoming(Request $request, string $id): JsonResponse
    {
        $data = $this->content($request);
        $clientId = $request->validate(['client_id' => ['required', 'uuid']])['client_id'];
        return response()->json(DB::transaction(function () use ($id, $data, $clientId) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(preg_match('/^[^@\s]+@example\.com$/i', $candidate->email) === 1, 422, 'Use a fictional example.com candidate for simulated incoming messages.');
            $existing = ApplicationMessage::find($clientId);
            if ($existing) {
                abort_unless($existing->candidate_id === $id && $existing->source === 'sample_follow_up' && $existing->subject === $data['subject'] && $existing->body === $data['body'], 409);
                return $existing;
            }
            $message = ApplicationMessage::create($data + [
                'id' => $clientId, 'candidate_id' => $id, 'direction' => 'inbound', 'delivery_status' => 'received',
                'sender' => $candidate->email, 'recipient' => ApplicationMailbox::ADDRESS, 'source' => 'sample_follow_up', 'version' => 1,
            ]);
            ApplicationMailbox::record($candidate, 'sample_email_received', $message);
            return $message;
        }), 201);
    }
}
