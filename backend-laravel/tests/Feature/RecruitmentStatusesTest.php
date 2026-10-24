<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Branch;
use App\Models\RecruitmentStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecruitmentStatusesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): static
    {
        return $this->withCredentials()->withUnencryptedCookie('seka_demo', 'admin:');
    }

    public function test_admin_can_create_assign_and_filter_custom_status(): void
    {
        $this->admin()->postJson('/api/admin/statuses', [
            'code' => 'on_hold', 'label_pl' => 'Wstrzymana', 'label_en' => 'On hold', 'color' => '#334455',
        ])->assertCreated();
        $candidate = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com']);
        $this->patchJson('/api/candidates/'.$candidate->id, ['status' => 'on_hold'])->assertOk();
        $this->getJson('/api/candidates?status=on_hold')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('by_status.on_hold', 1);
        $this->patchJson('/api/admin/statuses/on_hold', ['label_en' => 'Paused'])->assertOk()->assertJsonPath('label_en', 'Paused');
        $this->assertDatabaseHas('candidates', ['id' => $candidate->id, 'status' => 'on_hold']);
    }

    public function test_archived_status_retains_records_but_cannot_be_newly_assigned(): void
    {
        $first = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'status' => 'review']);
        $second = Candidate::create(['first_name' => 'Adam', 'last_name' => 'Test', 'email' => 'adam@example.com']);
        $this->admin()->patchJson('/api/admin/statuses/review', ['is_active' => false])->assertOk();
        $this->patchJson('/api/candidates/'.$second->id, ['status' => 'review'])->assertUnprocessable();
        $this->patchJson('/api/candidates/'.$first->id, ['status' => 'review', 'hr_notes' => 'Updated'])->assertOk();
        $this->getJson('/api/candidates?status=review')->assertOk()->assertJsonPath('total', 1);
        $this->patchJson('/api/admin/statuses/new', ['is_active' => false])->assertUnprocessable();
    }

    public function test_hr_cannot_manage_statuses_and_unknown_status_is_rejected(): void
    {
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'hr_manager:')
            ->patchJson('/api/admin/statuses/review', ['label_en' => 'Changed'])->assertForbidden();
        $candidate = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com']);
        $this->patchJson('/api/candidates/'.$candidate->id, ['status' => 'unknown'])->assertUnprocessable();
    }

    public function test_branch_manager_cannot_manage_statuses(): void
    {
        $branch = Branch::create(['name' => 'Warsaw', 'city' => 'Warszawa']);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$branch->id)
            ->patchJson('/api/admin/statuses/review', ['label_en' => 'Changed'])->assertForbidden();
        $this->getJson('/api/statuses')->assertOk()->assertJsonCount(5);
    }

    public function test_reordering_requires_the_complete_unique_list_and_codes_are_immutable(): void
    {
        $codes = RecruitmentStatus::orderBy('sort_order')->pluck('code')->reverse()->values()->all();
        $this->admin()->postJson('/api/admin/statuses/reorder', ['codes' => $codes])->assertOk()->assertJsonPath('0.code', $codes[0]);
        $this->postJson('/api/admin/statuses/reorder', ['codes' => ['new', 'new']])->assertUnprocessable();
        $this->postJson('/api/admin/statuses/reorder', ['codes' => ['new']])->assertUnprocessable();
        $this->patchJson('/api/admin/statuses/new', ['code' => 'renamed'])->assertUnprocessable();
    }
}
