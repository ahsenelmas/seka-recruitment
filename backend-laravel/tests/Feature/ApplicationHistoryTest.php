<?php

namespace Tests\Feature;

use App\Models\ApplicationEvent;
use App\Models\Branch;
use App\Models\Candidate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ApplicationHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function submission(array $extra = []): Candidate
    {
        return Candidate::create(array_merge([
            'first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'history@example.com',
        ], $extra));
    }

    public function test_changes_record_previous_values_without_copying_private_notes(): void
    {
        $candidate = $this->submission();
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'hr_manager:')
            ->patchJson('/api/candidates/'.$candidate->id, ['status' => 'review', 'hr_notes' => 'Private interview details'])
            ->assertOk();
        $event = ApplicationEvent::where('type', 'application_updated')->firstOrFail();
        $this->assertSame('new', $event->changes['status']['before']);
        $this->assertSame('review', $event->changes['status']['after']);
        $this->assertTrue($event->changes['hr_notes']['changed']);
        $this->assertStringNotContainsString('Private interview details', json_encode($event->changes));
        $this->assertSame('hr_manager', $event->actor_role);
        $this->assertTrue($event->simulated);
        $count = ApplicationEvent::count();
        $candidate->refresh()->save();
        $this->assertSame($count, ApplicationEvent::count());
    }

    public function test_other_branch_history_is_not_accessible(): void
    {
        $first = Branch::create(['name' => 'First', 'city' => 'Warszawa']);
        $other = Branch::create(['name' => 'Other', 'city' => 'Kraków']);
        $mine = $this->submission(['branch_id' => $first->id]);
        $theirs = $this->submission(['branch_id' => $other->id]);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$first->id)
            ->getJson('/api/candidates/'.$mine->id.'/history')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/candidates/'.$theirs->id.'/history')->assertNotFound();
    }

    public function test_rollback_removes_both_application_and_history(): void
    {
        DB::beginTransaction();
        $candidate = $this->submission();
        $id = $candidate->id;
        DB::rollBack();
        $this->assertDatabaseMissing('candidates', ['id' => $id]);
        $this->assertDatabaseMissing('application_events', ['candidate_id' => $id]);
    }

    public function test_cv_change_records_filename_without_storage_key(): void
    {
        $candidate = $this->submission();
        $candidate->update(['cv_storage_key' => 'cvs/private.pdf', 'cv_original_filename' => 'anna.pdf']);
        $event = ApplicationEvent::where('type', 'cv_uploaded')->firstOrFail();
        $this->assertSame(['filename' => 'anna.pdf'], $event->changes);
    }
}
