<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Candidate;
use App\Models\RecruitmentRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecruitmentRolesTest extends TestCase
{
    use RefreshDatabase;

    private function asRole(string $role, ?int $branch = null): static
    {
        return $this->withCredentials()->withUnencryptedCookie('seka_demo', $role.':'.($branch ?? ''));
    }

    private function assistant(array $overrides = []): RecruitmentRole
    {
        return RecruitmentRole::create(array_merge([
            'code' => 'assistant', 'label_pl' => 'Asystent', 'label_en' => 'Assistant', 'scope' => 'branch',
            'permissions' => ['applications.view', 'applications.edit_notes'], 'is_builtin' => false, 'is_active' => true,
        ], $overrides));
    }

    public function test_system_admin_and_admin_have_separate_authority(): void
    {
        $this->asRole('system_admin')->getJson('/api/system/settings')->assertOk();
        $this->getJson('/api/candidates')->assertForbidden();
        $this->getJson('/api/admin/roles')->assertForbidden();
        $this->patchJson('/api/admin/statuses/new', ['label_en' => 'Changed'])->assertForbidden();
        $this->asRole('admin')->getJson('/api/admin/roles')->assertOk();
        $this->getJson('/api/system/settings')->assertForbidden();
        $this->patchJson('/api/admin/roles/system_admin', [])->assertForbidden();
        $this->patchJson('/api/admin/roles/admin', [])->assertForbidden();
    }

    public function test_admin_can_define_assistant_but_cannot_grant_system_permissions(): void
    {
        $data = [
            'code' => 'assistant', 'label_pl' => 'Asystent', 'label_en' => 'Assistant', 'scope' => 'branch',
            'permissions' => ['applications.view', 'applications.edit_notes'],
        ];
        $this->asRole('admin')->postJson('/api/admin/roles', $data)->assertCreated();
        $updated = $data; unset($updated['code']);
        $updated['label_en'] = 'Branch Assistant';
        $this->patchJson('/api/admin/roles/assistant', $updated)->assertOk()->assertJsonPath('label_en', 'Branch Assistant');
        $this->postJson('/api/admin/roles', array_merge($data, ['code' => 'escalation', 'permissions' => ['applications.view', 'system.configure']]))->assertUnprocessable();
        $this->asRole('hr_manager')->postJson('/api/admin/roles', $data)->assertForbidden();
    }

    public function test_assistant_can_edit_only_notes_in_its_branch_and_cannot_open_cvs(): void
    {
        $this->assistant();
        $first = Branch::create(['name' => 'First', 'city' => 'Warszawa']);
        $other = Branch::create(['name' => 'Other', 'city' => 'Kraków']);
        $mine = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'branch_id' => $first->id]);
        $theirs = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'branch_id' => $other->id]);
        $this->asRole('assistant', $first->id)->getJson('/api/candidates')->assertOk()->assertJsonPath('total', 1);
        $this->patchJson('/api/candidates/'.$mine->id, ['hr_notes' => 'Follow up'])->assertOk();
        $this->patchJson('/api/candidates/'.$mine->id, ['status' => 'review'])->assertForbidden();
        $this->getJson('/api/candidates/'.$mine->id.'/cv')->assertForbidden();
        $this->getJson('/api/candidates/'.$theirs->id)->assertNotFound();
        $this->patchJson('/api/candidates/'.$theirs->id, ['hr_notes' => 'Forbidden'])->assertNotFound();
        $this->getJson('/api/candidates/'.$theirs->id.'/history')->assertNotFound();
        $this->getJson('/api/applicants/'.$mine->applicant_id)->assertOk()->assertJsonPath('visible_application_count', 1);
        $this->postJson('/api/intake/sample-email', [])->assertForbidden();
    }

    public function test_permission_changes_take_effect_without_changing_cookie(): void
    {
        $role = $this->assistant(['scope' => 'all']);
        $candidate = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com']);
        $this->asRole('assistant')->patchJson('/api/candidates/'.$candidate->id, ['hr_notes' => 'Allowed'])->assertOk();
        $role->update(['permissions' => ['applications.view']]);
        $this->patchJson('/api/candidates/'.$candidate->id, ['hr_notes' => 'Denied'])->assertForbidden();
        $role->update(['is_active' => false]);
        $this->getJson('/api/candidates')->assertStatus(400);
        $this->getJson('/api/demo/catalog')->assertOk();
    }

    public function test_branch_role_requires_a_valid_branch_and_health_ignores_stale_cookie(): void
    {
        $this->assistant();
        $this->asRole('admin')->postJson('/api/demo/context', ['role' => 'assistant'])->assertUnprocessable();
        $this->postJson('/api/demo/context', ['role' => 'assistant', 'branch_id' => 99999])->assertUnprocessable();
        $this->asRole('invalid')->getJson('/api/health')->assertOk();
        $this->getJson('/api/demo/catalog')->assertOk();
    }
}
