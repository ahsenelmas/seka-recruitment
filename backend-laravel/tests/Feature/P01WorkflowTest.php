<?php

namespace Tests\Feature;

use App\Models\ApplicationMessage;
use App\Models\Branch;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class P01WorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function application(array $over = []): Candidate
    {
        return Candidate::create($over + ['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com']);
    }

    private function employee(string $role, ?int $branch = null): DemoEmployee
    {
        return DemoEmployee::create(['name' => 'Test '.$role, 'email' => Str::uuid().'@example.com', 'role_code' => $role, 'branch_id' => $branch, 'is_active' => true, 'is_demo' => true]);
    }

    private function asEmployee(DemoEmployee $e): static
    {
        return $this->withCredentials()->withUnencryptedCookie('seka_demo_employee', $e->id);
    }

    public function test_structured_records_capture_actor_status_and_phone_outcome(): void
    {
        $c = $this->application();
        $hr = $this->employee('hr_manager');
        $this->asEmployee($hr)->postJson('/api/p01/applications/'.$c->id.'/notes', ['content' => 'Review the experience'])->assertCreated();
        $this->assertDatabaseHas('application_notes', ['candidate_id' => $c->id, 'actor_id' => $hr->id, 'process_status' => 'new', 'content' => 'Review the experience']);
        $this->postJson('/api/p01/applications/'.$c->id.'/contacts', ['event_code' => 'phone', 'occurred_at' => now()->toIso8601String()])->assertUnprocessable();
        $this->postJson('/api/p01/applications/'.$c->id.'/contacts', ['event_code' => 'phone', 'purpose_code' => 'schedule_interview', 'phone_outcome' => 'not_answered', 'occurred_at' => now()->toIso8601String()])->assertCreated();
        $this->postJson('/api/p01/applications/'.$c->id.'/contacts', ['event_code' => 'email_sent', 'occurred_at' => now()->toIso8601String()])->assertUnprocessable();
    }

    public function test_process_is_versioned_main_state_is_derived_and_interview_requires_details(): void
    {
        $c = $this->application();
        $url = '/api/p01/applications/'.$c->id.'/process';
        $this->patchJson($url, ['version' => 1, 'status' => 'interview_scheduled'])->assertUnprocessable();
        $this->patchJson($url, ['version' => 1, 'status' => 'interview_scheduled', 'interview_at' => now()->addDay()->toIso8601String(), 'interview_format' => 'video'])->assertOk()->assertJsonPath('main_state', 'in_progress');
        $this->patchJson($url, ['version' => 1, 'status' => 'preliminary'])->assertConflict();
        $this->patchJson($url, ['version' => 2, 'status' => 'rejected_interview', 'rejection_reason' => 'Experience does not match'])->assertOk()->assertJsonPath('main_state', 'finished');
        $this->assertNotNull($c->fresh()->completed_at);
        $this->patchJson($url, ['version' => 3, 'status' => 'preliminary'])->assertUnprocessable();
    }

    public function test_consent_requires_evidence(): void
    {
        $c = $this->application();
        $url = '/api/p01/applications/'.$c->id.'/process';
        $this->patchJson($url, ['version' => 1, 'future_consent' => true])->assertUnprocessable();
        $this->patchJson($url, ['version' => 1, 'future_consent' => true, 'consent_evidence' => 'Explicit consent in source email'])->assertOk();
        $this->assertNotNull($c->fresh()->consent_recorded_at);
    }

    public function test_deputy_access_is_specific_revocable_and_does_not_follow_email(): void
    {
        $c = $this->application();
        $other = $this->application();
        $hr = $this->employee('hr_manager');
        $deputy = $this->employee('deputy_director');
        $this->asEmployee($hr)->postJson('/api/p01/applications/'.$c->id.'/grants', ['employee_id' => $deputy->id])->assertOk();
        $this->asEmployee($deputy)->getJson('/api/candidates/'.$c->id)->assertOk();
        $this->getJson('/api/candidates/'.$other->id)->assertNotFound();
        $this->postJson('/api/p01/applications/'.$c->id.'/notes', ['content' => 'Deputy review'])->assertCreated();
        $this->postJson('/api/p01/applications/'.$other->id.'/notes', ['content' => 'Forbidden'])->assertNotFound();
        $grant = DB::table('application_grants')->first();
        $this->asEmployee($hr)->deleteJson('/api/p01/applications/'.$c->id.'/grants/'.$grant->id)->assertOk();
        $this->asEmployee($deputy)->getJson('/api/candidates/'.$c->id)->assertNotFound();
    }

    public function test_expired_grant_is_not_access_and_unit_director_cannot_grant_deputy_access(): void
    {
        $b = Branch::create(['name' => 'Warsaw', 'city' => 'Warszawa']);
        $c = $this->application(['branch_id' => $b->id]);
        $e = $this->employee('deputy_director');
        DB::table('application_grants')->insert(['candidate_id' => $c->id, 'employee_id' => $e->id, 'actor_label' => 'HR', 'process_status' => 'new', 'grant_kind' => 'deputy_director', 'expires_at' => now()->subMinute(), 'created_at' => now(), 'updated_at' => now()]);
        $this->asEmployee($e)->getJson('/api/p01/applications/'.$c->id)->assertNotFound();
        $director = $this->employee('branch_manager', $b->id);
        $this->asEmployee($director)->postJson('/api/p01/applications/'.$c->id.'/grants', ['employee_id' => $e->id])->assertForbidden();
    }

    public function test_specialist_reviews_only_granted_application_and_decision_does_not_change_process(): void
    {
        $c = $this->application();
        $other = $this->application();
        $hr = $this->employee('hr_manager');
        $specialist = $this->employee('specialist_director');
        $response = $this->asEmployee($hr)->postJson('/api/p01/applications/'.$c->id.'/reviews', ['reviewer_id' => $specialist->id, 'stage' => 'confirmation'])->assertCreated();
        $id = $response->json('id');
        $this->asEmployee($specialist)->getJson('/api/candidates/'.$c->id)->assertOk();
        $this->getJson('/api/candidates/'.$other->id)->assertNotFound();
        $this->patchJson('/api/p01/applications/'.$c->id.'/process', ['version' => 1, 'status' => 'rejected'])->assertForbidden();
        $this->patchJson('/api/p01/applications/'.$c->id.'/reviews/'.$id, ['version' => 1, 'decision' => 'rejected', 'opinion' => 'Qualification not confirmed'])->assertOk();
        $this->assertSame('new', $c->fresh()->status);
        $this->assertDatabaseHas('qualification_reviews', ['id' => $id, 'decision' => 'rejected']);
        $this->patchJson('/api/p01/applications/'.$c->id.'/reviews/'.$id, ['version' => 1, 'decision' => 'accepted', 'opinion' => 'Overwrite'])->assertConflict();
        $this->assertDatabaseHas('recruitment_notifications', ['employee_id' => $hr->id, 'kind' => 'qualification_decided']);
    }

    public function test_technical_admin_can_configure_dictionaries_without_reading_applications(): void
    {
        $c = $this->application();
        $e = $this->employee('system_admin');
        $this->asEmployee($e)->getJson('/api/p01/applications/'.$c->id)->assertForbidden();
        $this->getJson('/api/p01/dictionaries')->assertOk();
        $this->postJson('/api/p01/dictionaries', ['kind' => 'purpose', 'code' => 'documents', 'label_pl' => 'Dokumenty', 'label_en' => 'Documents'])->assertCreated();
        $this->postJson('/api/p01/units', ['code' => 'dept-training', 'name' => 'Dział szkoleń', 'city' => 'Warszawa', 'unit_type' => 'department'])->assertCreated();
    }

    public function test_mail_ingest_is_key_protected_deduplicated_and_not_an_application_until_reviewed(): void
    {
        Storage::fake('local');
        config(['p01.ingest_key' => str_repeat('k', 32)]);
        $d = ['message_id' => 'message-one', 'sender' => 'anna@example.com', 'subject' => 'Application', 'body' => 'Interested in training roles.'];
        $this->postJson('/api/mailbox/ingest', $d)->assertUnauthorized();
        $response = $this->withHeader('X-SEKA-Ingest-Key', str_repeat('k', 32))->postJson('/api/mailbox/ingest', $d)->assertCreated();
        $id = $response->json('id');
        $this->postJson('/api/mailbox/ingest', $d)->assertOk()->assertJsonPath('duplicate', true);
        $this->postJson('/api/mailbox/ingest', array_replace($d, ['body' => 'Different']))->assertConflict();
        $this->assertSame(0, Candidate::count());
        $this->asEmployee($this->employee('hr_manager'))->postJson('/api/p01/intake/'.$id.'/accept', ['first_name' => 'Anna', 'last_name' => 'Test'])->assertCreated();
        $this->assertSame(1, Candidate::count());
        $this->postJson('/api/p01/intake/'.$id.'/accept', ['first_name' => 'Anna', 'last_name' => 'Test'])->assertOk()->assertJsonPath('duplicate', true);
        $this->assertSame(1, Candidate::count());
    }

    public function test_manual_intake_is_separate_from_email(): void
    {
        $this->postJson('/api/p01/manual', ['first_name' => 'Jan', 'last_name' => 'Test', 'email' => 'jan@example.com'])->assertCreated()->assertJsonPath('source', 'manual');
        $this->assertSame(0, ApplicationMessage::count());
    }

    public function test_retention_is_dry_run_by_default_and_uses_completion_and_consent(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('cvs/expired.pdf', 'fake');
        $expired = $this->application(['status' => 'rejected', 'cv_storage_key' => 'cvs/expired.pdf']);
        $expired->completed_at = now()->subDays(60);
        $expired->save();
        $kept = $this->application(['status' => 'rejected']);
        $kept->future_consent = true;
        $kept->completed_at = now()->subDays(60);
        $kept->save();
        $ongoing = $this->application();
        config(['p01.retention_days' => 30, 'p01.consent_retention_days' => 90, 'p01.retention_enabled' => true]);
        $this->artisan('seka:purge')->assertExitCode(0);
        $this->assertDatabaseHas('candidates', ['id' => $expired->id]);
        $this->artisan('seka:purge', ['--execute' => true])->assertExitCode(0);
        $this->assertDatabaseMissing('candidates', ['id' => $expired->id]);
        $this->assertDatabaseHas('candidates', ['id' => $kept->id]);
        $this->assertDatabaseHas('candidates', ['id' => $ongoing->id]);
        Storage::disk('local')->assertMissing('cvs/expired.pdf');
    }

    public function test_entra_mode_cannot_be_bypassed_with_demo_cookies(): void
    {
        config(['p01.auth_mode' => 'entra']);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'hr_manager:')->getJson('/api/candidates')->assertUnauthorized();
        $this->postJson('/api/demo/context', ['role' => 'hr_manager'])->assertForbidden();
    }

    public function test_sending_is_opt_in_fixed_mailbox_and_cannot_repeat(): void
    {
        $c = $this->application();
        $m = ApplicationMessage::create(['candidate_id' => $c->id, 'direction' => 'outbound', 'delivery_status' => 'draft', 'sender' => 'kariera@seka.pl', 'recipient' => $c->email, 'subject' => 'Thank you', 'body' => 'Reviewed', 'source' => 'reply_draft', 'version' => 1]);
        $url = '/api/p01/applications/'.$c->id.'/messages/'.$m->id.'/send';
        $this->postJson($url, ['version' => 1, 'confirmed' => true])->assertStatus(503);
        config(['p01.mail_enabled' => true, 'mail.default' => 'smtp']);
        $message = \Mockery::mock(Message::class);
        $message->shouldReceive('from')->once()->with('kariera@seka.pl', 'SEKA HR')->andReturnSelf();
        $message->shouldReceive('replyTo')->once()->with('kariera@seka.pl')->andReturnSelf();
        $message->shouldReceive('to')->once()->with($c->email)->andReturnSelf();
        $message->shouldReceive('subject')->once()->with('Thank you [SEKA:'.$c->id.']')->andReturnSelf();
        Mail::shouldReceive('raw')->once()->with('Reviewed', \Mockery::on(function ($callback) use ($message) {
            $callback($message);

            return true;
        }));
        $this->postJson($url, ['version' => 1, 'confirmed' => true])->assertOk();
        $this->postJson($url, ['version' => 1, 'confirmed' => true])->assertConflict();
        $this->assertDatabaseHas('application_contacts', ['candidate_id' => $c->id, 'event_code' => 'email_sent']);
    }

    public function test_contact_records_are_paginated_and_purpose_can_be_completed(): void
    {
        $c = $this->application();
        for ($i = 0; $i < 31; $i++) {
            DB::table('application_contacts')->insert(['candidate_id' => $c->id, 'actor_label' => 'HR', 'process_status' => 'new', 'event_code' => 'phone', 'phone_outcome' => 'answered', 'occurred_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->getJson('/api/p01/applications/'.$c->id.'?contacts_page=2')->assertOk()->assertJsonCount(1, 'contacts')->assertJsonPath('paging.contacts.total', 31);
        $contact = DB::table('application_contacts')->where('candidate_id', $c->id)->first();
        $this->patchJson('/api/p01/applications/'.$c->id.'/contacts/'.$contact->id, ['purpose_code' => 'schedule_interview'])->assertOk();
        $this->assertDatabaseHas('application_contacts', ['id' => $contact->id, 'purpose_code' => 'schedule_interview']);
    }

    public function test_additional_documents_are_private_and_do_not_replace_the_cv(): void
    {
        Storage::fake('local');
        $a = Branch::create(['name' => 'A', 'city' => 'Warszawa']);
        $b = Branch::create(['name' => 'B', 'city' => 'Kraków']);
        $c = $this->application(['branch_id' => $a->id]);
        $file = UploadedFile::fake()->image('certificate.png');
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$a->id)->postJson('/api/p01/applications/'.$c->id.'/attachments', ['file' => $file])->assertCreated();
        $attachment = DB::table('application_attachments')->first();
        $this->assertNull($c->fresh()->cv_storage_key);
        $this->getJson('/api/p01/attachments/'.$attachment->id)->assertOk();
        $this->withUnencryptedCookie('seka_demo', 'branch_manager:'.$b->id)->getJson('/api/p01/attachments/'.$attachment->id)->assertNotFound();
    }

    public function test_delivery_failure_requires_provider_reconciliation_instead_of_blind_retry(): void
    {
        $c = $this->application();
        $m = ApplicationMessage::create(['candidate_id' => $c->id, 'direction' => 'outbound', 'delivery_status' => 'draft', 'sender' => 'kariera@seka.pl', 'recipient' => $c->email, 'subject' => 'Reply', 'body' => 'Body', 'source' => 'reply_draft', 'version' => 1]);
        config(['p01.mail_enabled' => true, 'mail.default' => 'smtp']);
        Mail::shouldReceive('raw')->once()->andThrow(new \RuntimeException('Transport unavailable'));
        $url = '/api/p01/applications/'.$c->id.'/messages/'.$m->id.'/send';
        $this->postJson($url, ['version' => 1, 'confirmed' => true])->assertStatus(502);
        $this->assertSame('delivery_uncertain', $m->fresh()->delivery_status);
        $this->postJson($url, ['version' => 1, 'confirmed' => true])->assertConflict();
    }
}
