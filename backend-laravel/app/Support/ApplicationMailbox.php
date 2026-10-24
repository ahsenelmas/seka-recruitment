<?php

namespace App\Support;

use App\Models\ApplicationEvent;
use App\Models\ApplicationMessage;
use App\Models\Candidate;

class ApplicationMailbox
{
    public const ADDRESS = 'kariera@seka.pl';

    public static function captureOriginal(Candidate $candidate): void
    {
        if ($candidate->email_subject === null && $candidate->email_body === null) return;
        ApplicationMessage::create([
            'candidate_id' => $candidate->id, 'direction' => 'inbound', 'delivery_status' => 'received',
            'sender' => $candidate->email, 'recipient' => self::ADDRESS,
            'subject' => $candidate->email_subject ?? '', 'body' => $candidate->email_body ?? '',
            'source' => 'sample_intake', 'version' => 1,
        ]);
    }

    public static function record(Candidate $candidate, string $type, ApplicationMessage $message): void
    {
        $role = request()->attributes->get('seka_demo_role');
        ApplicationEvent::create([
            'candidate_id' => $candidate->id, 'type' => $type,
            'actor_role' => is_string($role) ? $role : 'system', 'simulated' => is_string($role),
            'changes' => ['message_id' => $message->id], 'created_at' => now(),
        ]);
    }
}
