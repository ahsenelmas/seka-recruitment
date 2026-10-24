<?php
namespace Tests\Feature;

use App\Models\ApplicationTask;
use App\Models\Branch;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApplicationWorkTest extends TestCase
{
    use RefreshDatabase;

    private function fixtures(): array
    {
        $first = Branch::create(['name' => 'First', 'city' => 'Warszawa']);
        $other = Branch::create(['name' => 'Other', 'city' => 'Kraków']);
        $employee = DemoEmployee::create(['name' => 'Fictional Assistant', 'email' => 'assistant.test@example.com', 'role_code' => 'demo_assistant', 'branch_id' => $first->id, 'is_demo' => true, 'is_active' => true]);
        $secondEmployee = DemoEmployee::create(['name' => 'Other Assistant', 'email' => 'assistant.other@example.com', 'role_code' => 'demo_assistant', 'branch_id' => $first->id, 'is_demo' => true, 'is_active' => true]);
        $candidate = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'branch_id' => $first->id]);
        $otherCandidate = Candidate::create(['first_name' => 'Adam', 'last_name' => 'Test', 'email' => 'adam@example.com', 'branch_id' => $other->id]);
        return [$first, $other, $employee, $secondEmployee, $candidate, $otherCandidate];
    }

    private function hr(): static
    {
        return $this->withCredentials()->withUnencryptedCookie('seka_demo', 'hr_manager:');
    }

    private function task(Candidate $candidate, DemoEmployee $employee): ApplicationTask
    {
        return ApplicationTask::create(['candidate_id' => $candidate->id, 'assignee_employee_id' => $employee->id, 'title' => 'Review CV', 'status' => 'open', 'version' => 1, 'due_on' => now('Europe/Warsaw')->subDay()->format('Y-m-d')]);
    }

    public function test_owner_and_follow_up_are_versioned_and_reject_ineligible_staff(): void
    {
        [$first, $other, $employee, $second, $candidate, $otherCandidate] = $this->fixtures();
        $url = '/api/candidates/'.$candidate->id.'/work';
        $this->hr()->patchJson($url, ['version' => 1, 'owner_employee_id' => $employee->id, 'follow_up_on' => '2026-12-01'])->assertOk()->assertJsonPath('work_version', 2)->assertJsonPath('owner.name', 'Fictional Assistant');
        $this->patchJson($url, ['version' => 1, 'owner_employee_id' => null, 'follow_up_on' => null])->assertConflict();
        $this->patchJson('/api/candidates/'.$otherCandidate->id.'/work', ['version' => 1, 'owner_employee_id' => $employee->id, 'follow_up_on' => null])->assertUnprocessable();
        $system = DemoEmployee::where('role_code', 'system_admin')->firstOrFail();
        $this->patchJson($url, ['version' => 2, 'owner_employee_id' => $system->id, 'follow_up_on' => null])->assertUnprocessable();
    }

    public function test_task_create_retry_is_idempotent_and_updates_reject_stale_version(): void
    {
        [$first, $other, $employee, $second, $candidate] = $this->fixtures();
        $id = (string) Str::uuid(); $url = '/api/candidates/'.$candidate->id.'/tasks';
        $data = ['client_id' => $id, 'title' => 'Review CV', 'assignee_employee_id' => $employee->id, 'due_on' => '2026-12-01'];
        $this->hr()->postJson($url, $data)->assertCreated();
        $this->postJson($url, $data)->assertCreated();
        $this->assertDatabaseCount('application_tasks', 1);
        $this->patchJson($url.'/'.$id, ['version' => 1, 'status' => 'done'])->assertOk()->assertJsonPath('version', 2);
        $this->patchJson($url.'/'.$id, ['version' => 1, 'status' => 'open'])->assertConflict();
        $this->assertDatabaseHas('application_events', ['candidate_id' => $candidate->id, 'type' => 'task_created']);
    }

    public function test_demo_employee_identity_controls_my_tasks_and_cannot_be_changed_with_role_cookie(): void
    {
        [$first, $other, $employee, $second, $candidate, $otherCandidate] = $this->fixtures();
        $mine = $this->task($candidate, $employee); $theirs = $this->task($candidate, $second); $this->task($otherCandidate, $employee);
        $this->withCredentials()->withUnencryptedCookie('seka_demo_employee', $employee->id)->withUnencryptedCookie('seka_demo', 'admin:')
            ->getJson('/api/demo/context')->assertOk()->assertJsonPath('role', 'demo_assistant')->assertJsonPath('employee.id', $employee->id);
        $this->getJson('/api/tasks?mine=1')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.is_overdue', true);
        $this->patchJson('/api/candidates/'.$candidate->id.'/tasks/'.$mine->id, ['version' => 1, 'status' => 'done'])->assertOk();
        $this->patchJson('/api/candidates/'.$candidate->id.'/tasks/'.$theirs->id, ['version' => 1, 'status' => 'done'])->assertForbidden();
        $this->patchJson('/api/candidates/'.$candidate->id.'/tasks/'.$mine->id, ['version' => 2, 'title' => 'Change title'])->assertForbidden();
        $this->getJson('/api/candidates/'.$otherCandidate->id.'/work')->assertNotFound();
    }

    public function test_role_preview_has_no_personal_identity_and_invalid_demo_cookie_can_recover(): void
    {
        $this->hr()->getJson('/api/demo/context')->assertOk()->assertJsonPath('employee', null);
        $this->getJson('/api/tasks?mine=1')->assertUnprocessable();
        $this->withUnencryptedCookie('seka_demo_employee', 'invalid')->getJson('/api/demo/context')->assertStatus(400);
        $this->getJson('/api/demo/catalog')->assertOk();
        $this->postJson('/api/demo/context', ['role' => 'hr_manager'])->assertOk();
    }

    public function test_branch_transfer_clears_incompatible_owner_and_open_task_assignment(): void
    {
        [$first, $other, $employee, $second, $candidate] = $this->fixtures();
        $this->hr()->patchJson('/api/candidates/'.$candidate->id.'/work', ['version' => 1, 'owner_employee_id' => $employee->id, 'follow_up_on' => null])->assertOk();
        $task = $this->task($candidate, $employee);
        $this->patchJson('/api/candidates/'.$candidate->id, ['branch_id' => $other->id])->assertOk();
        $this->assertNull($candidate->fresh()->owner_employee_id);
        $this->assertNull($task->fresh()->assignee_employee_id);
        $this->assertSame(2, $task->fresh()->version);
        $this->assertDatabaseHas('application_events', ['candidate_id' => $candidate->id, 'type' => 'owner_cleared_after_transfer']);
        $this->assertDatabaseHas('application_events', ['candidate_id' => $candidate->id, 'type' => 'task_unassigned_after_transfer']);
    }

    public function test_demo_login_sets_identity_and_rejects_inactive_accounts(): void
    {
        [$first, $other, $employee] = $this->fixtures();
        $this->postJson('/api/demo/employee', ['employee_id' => $employee->id])->assertOk()->assertCookie('seka_demo_employee');
        $employee->update(['is_active' => false]);
        $this->postJson('/api/demo/employee', ['employee_id' => $employee->id])->assertNotFound();
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'system_admin:')->getJson('/api/tasks')->assertForbidden();
    }
}
