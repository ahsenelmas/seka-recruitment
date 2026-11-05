<?php

namespace App\Support;

use App\Models\ApplicationEvent;
use App\Models\ApplicationMessage;
use App\Models\Candidate;
use Illuminate\Support\Facades\DB;

class ApplicationMailbox
{
    public const ADDRESS = 'kariera@seka.pl';

    public static function captureOriginal(Candidate $candidate): void
    {
        if ($candidate->email_subject === null && $candidate->email_body === null) {
            return;
        }
        $message = ApplicationMessage::create([
            'candidate_id' => $candidate->id, 'direction' => 'inbound', 'delivery_status' => 'received',
            'sender' => $candidate->email, 'recipient' => self::ADDRESS,
            'subject' => $candidate->email_subject ?? '', 'body' => $candidate->email_body ?? '',
            'source' => $candidate->source === 'email' ? 'mailbox_import' : 'sample_intake', 'version' => 1,
        ]);
        DB::table('application_contacts')->insert(P01::base($candidate) + ['event_code' => 'email_received', 'message_id' => $message->id, 'occurred_at' => now(), 'origin' => 'email']);
    }

    public static function record(Candidate $candidate, string $type, ApplicationMessage $message): void
    {
        if ($message->direction === 'inbound') {
            DB::table('application_contacts')->insert(P01::base($candidate) + ['event_code' => 'email_received', 'message_id' => $message->id, 'occurred_at' => now(), 'origin' => 'email']);
            P01::notify($candidate, 'new_message');
        }

        $role = request()->attributes->get('seka_demo_role');
        ApplicationEvent::create([
            'candidate_id' => $candidate->id, 'type' => $type,
            'actor_role' => is_string($role) ? $role : 'system', 'simulated' => request()->attributes->get('seka_auth_simulated', true),
            'changes' => ['message_id' => $message->id], 'created_at' => now(),
        ]);
    }
}
