<?php

namespace Tests\Feature;

use App\Models\ApplicationMessage;
use App\Models\Branch;
use App\Models\Candidate;
use App\Models\RecruitmentRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApplicationMailboxTest extends TestCase
{
    use RefreshDatabase;

    private function asRole(string $role, ?int $branch = null): static
    {
        return $this->withCredentials()->withUnencryptedCookie('seka_demo', $role.':'.($branch ?? ''));
    }

    private function candidate(array $extra = []): Candidate
    {
        return Candidate::create(array_merge([
            'first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com',
            'email_subject' => 'Spontaneous application', 'email_body' => 'Please consider my application.',
        ], $extra));
    }

    public function test_original_message_is_captured_and_threads_stay_application_specific(): void
    {
        $first = $this->candidate();
        $second = $this->candidate(['email_subject' => 'Another submission']);
        $this->assertSame($first->applicant_id, $second->applicant_id);
        $this->assertDatabaseCount('application_messages', 2);
        $this->asRole('hr_manager')->getJson('/api/candidates/'.$first->id.'/messages')
            ->assertOk()->assertJsonPath('delivery_connected', false)->assertJsonPath('messages.total', 1)
            ->assertJsonPath('messages.data.0.subject', 'Spontaneous application');
        $this->getJson('/api/inbox')->assertOk()->assertJsonPath('total', 2);
    }

    public function test_reply_is_a_fixed_sender_draft_and_retry_does_not_duplicate_or_send(): void
    {
        Mail::fake();
        $candidate = $this->candidate();
        $data = ['client_id' => (string) Str::uuid(), 'subject' => 'Re: Application', 'body' => 'Please provide your CV.'];
        $url = '/api/candidates/'.$candidate->id.'/messages';
        $this->asRole('hr_manager')->postJson($url, $data)->assertCreated()
            ->assertJsonPath('sender', 'kariera@seka.pl')->assertJsonPath('recipient', 'anna@example.com')
            ->assertJsonPath('delivery_status', 'draft')->assertJsonPath('direction', 'outbound');
        $this->postJson($url, $data)->assertCreated();
        $this->assertDatabaseCount('application_messages', 2);
        $this->assertDatabaseCount('application_events', 2);
        $this->getJson('/api/inbox?filter=drafts')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.draft_count', 1);
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('reply_drafts', 1);
        $this->postJson($url, array_merge($data, ['sender' => 'other@example.com']))->assertUnprocessable();
        $this->postJson($url, array_merge($data, ['delivery_status' => 'sent']))->assertUnprocessable();
        Mail::assertNothingSent(); Mail::assertNothingQueued();
    }

    public function test_optimistic_version_prevents_overwriting_a_newer_draft(): void
    {
        $candidate = $this->candidate();
        $id = (string) Str::uuid();
        $url = '/api/candidates/'.$candidate->id.'/messages';
        $this->asRole('hr_manager')->postJson($url, ['client_id' => $id, 'subject' => 'Reply', 'body' => 'First'])->assertCreated();
        $this->patchJson($url.'/'.$id, ['version' => 1, 'subject' => 'Reply', 'body' => 'Second'])->assertOk()->assertJsonPath('version', 2);
        $this->patchJson($url.'/'.$id, ['version' => 1, 'subject' => 'Reply', 'body' => 'Stale'])->assertConflict();
        $this->assertDatabaseHas('application_messages', ['id' => $id, 'body' => 'Second', 'version' => 2]);
        $incoming = ApplicationMessage::where('direction', 'inbound')->firstOrFail();
        $this->patchJson($url.'/'.$incoming->id, ['version' => 1, 'subject' => 'Changed', 'body' => 'Changed'])->assertConflict();
    }

    public function test_branch_reader_cannot_access_other_branch_or_write_drafts(): void
    {
        $first = Branch::create(['name' => 'First', 'city' => 'Warszawa']);
        $other = Branch::create(['name' => 'Other', 'city' => 'Kraków']);
        $mine = $this->candidate(['branch_id' => $first->id]);
        $theirs = $this->candidate(['branch_id' => $other->id]);
        $this->asRole('branch_manager', $first->id)->getJson('/api/inbox')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/candidates/'.$mine->id.'/messages')->assertOk();
        $this->getJson('/api/candidates/'.$theirs->id.'/messages')->assertNotFound();
        $this->postJson('/api/candidates/'.$mine->id.'/messages', [])->assertForbidden();
        $this->postJson('/api/candidates/'.$mine->id.'/messages/sample-incoming', [])->assertForbidden();
    }

    public function test_custom_branch_drafter_is_scoped_and_without_permission_source_is_hidden(): void
    {
        $branch = Branch::create(['name' => 'First', 'city' => 'Warszawa']);
        $other = Branch::create(['name' => 'Other', 'city' => 'Kraków']);
        $mine = $this->candidate(['branch_id' => $branch->id]);
        $theirs = $this->candidate(['branch_id' => $other->id]);
        $role = RecruitmentRole::create(['code' => 'assistant', 'label_pl' => 'Asystent', 'label_en' => 'Assistant', 'scope' => 'branch', 'permissions' => ['applications.view', 'correspondence.view', 'correspondence.draft'], 'is_builtin' => false, 'is_active' => true]);
        $payload = ['client_id' => (string) Str::uuid(), 'subject' => 'Reply', 'body' => 'Follow up'];
        $this->asRole('assistant', $branch->id)->postJson('/api/candidates/'.$mine->id.'/messages', $payload)->assertCreated();
        $this->postJson('/api/candidates/'.$theirs->id.'/messages', $payload)->assertNotFound();
        $role->update(['permissions' => ['applications.view']]);
        $this->getJson('/api/inbox')->assertForbidden();
        $this->getJson('/api/candidates/'.$mine->id.'/messages')->assertForbidden();
        $this->getJson('/api/candidates/'.$mine->id)->assertOk()->assertJsonMissingPath('email_subject')->assertJsonMissingPath('email_body');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('reply_drafts', null);
    }

    public function test_simulated_follow_up_is_idempotent_and_system_admin_cannot_read_mail(): void
    {
        $candidate = $this->candidate();
        $data = ['client_id' => (string) Str::uuid(), 'subject' => 'More information', 'body' => 'I prefer Warsaw.'];
        $url = '/api/candidates/'.$candidate->id.'/messages/sample-incoming';
        $this->asRole('hr_manager')->postJson($url, $data)->assertCreated()->assertJsonPath('source', 'sample_follow_up');
        $this->postJson($url, $data)->assertCreated();
        $this->assertDatabaseCount('application_messages', 2);
        $this->asRole('system_admin')->getJson('/api/inbox')->assertForbidden();
        $this->getJson('/api/candidates/'.$candidate->id.'/messages')->assertForbidden();
    }

    public function test_conversations_paginate_and_candidate_rollback_also_removes_messages(): void
    {
        $candidate = $this->candidate();
        for ($index = 0; $index < 21; $index++) {
            ApplicationMessage::create(['candidate_id' => $candidate->id, 'direction' => 'inbound', 'delivery_status' => 'received', 'sender' => 'anna@example.com', 'recipient' => 'kariera@seka.pl', 'subject' => 'Follow up '.$index, 'body' => 'Fictional', 'source' => 'sample_follow_up']);
        }
        $this->asRole('hr_manager')->getJson('/api/candidates/'.$candidate->id.'/messages?page=2')->assertOk()->assertJsonPath('messages.total', 22)->assertJsonCount(2, 'messages.data');
        DB::beginTransaction();
        $temporary = $this->candidate(); $id = $temporary->id;
        DB::rollBack();
        $this->assertDatabaseMissing('application_messages', ['candidate_id' => $id]);
    }
}
