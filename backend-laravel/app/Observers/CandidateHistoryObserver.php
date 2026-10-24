<?php

namespace App\Observers;

use App\Models\ApplicationEvent;
use App\Models\Candidate;

class CandidateHistoryObserver
{
    public function created(Candidate $candidate): void
    {
        $this->record($candidate, 'application_created', []);
        \App\Support\ApplicationMailbox::captureOriginal($candidate);
        if ($candidate->cv_storage_key) {
            $this->record($candidate, 'cv_uploaded', ['filename' => $candidate->cv_original_filename]);
        }
    }

    public function updated(Candidate $candidate): void
    {
        $changes = [];
        foreach (['status', 'branch_id', 'position'] as $field) {
            if ($candidate->wasChanged($field)) {
                $changes[$field] = ['before' => $candidate->getRawOriginal($field), 'after' => $candidate->getAttribute($field)];
            }
        }
        // Record that notes changed, without duplicating their sensitive content.
        if ($candidate->wasChanged('hr_notes')) {
            $changes['hr_notes'] = ['changed' => true];
        }
        if ($changes !== []) $this->record($candidate, 'application_updated', $changes);
        if ($candidate->wasChanged('cv_storage_key') && $candidate->cv_storage_key) {
            $this->record($candidate, 'cv_uploaded', ['filename' => $candidate->cv_original_filename]);
        }
        \App\Support\ApplicationWork::reconcileBranch($candidate);
    }

    private function record(Candidate $candidate, string $type, array $changes): void
    {
        $role = request()->attributes->get('seka_demo_role');
        ApplicationEvent::create([
            'candidate_id' => $candidate->id,
            'type' => $type,
            'actor_role' => is_string($role) ? $role : 'system',
            'simulated' => is_string($role),
            'changes' => $changes,
            'created_at' => now(),
        ]);
    }
}
