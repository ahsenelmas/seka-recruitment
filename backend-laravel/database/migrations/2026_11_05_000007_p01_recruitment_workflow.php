<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('demo_employees', function (Blueprint $t) {
            $t->dropUnique(['email']);
            $t->uuid('azure_oid')->nullable();
            $t->uuid('azure_tid')->nullable();
            $t->unique(['azure_oid', 'azure_tid']);
        });
        Schema::create('seka_auth_sessions', function (Blueprint $t) {
            $t->string('token_hash', 64)->primary();
            $t->foreignUuid('employee_id')->constrained('demo_employees')->cascadeOnDelete();
            $t->timestampTz('expires_at');
            $t->timestampsTz();
        });
        Schema::table('branches', function (Blueprint $t) {
            $t->string('unit_type', 20)->default('branch');
            $t->string('code', 80)->nullable()->unique();
            $t->dropUnique(['city']);
        });
        foreach (DB::table('branches')->get() as $unit) {
            DB::table('branches')->where('id', $unit->id)->update(['code' => 'unit-'.$unit->id]);
        }
        $technical = DB::table('recruitment_roles')->where('code', 'system_admin')->first();
        if ($technical) {
            DB::table('recruitment_roles')->where('code', 'system_admin')->update(['permissions' => json_encode(array_merge(json_decode($technical->permissions, true), ['statuses.manage']))]);
        }
        Schema::table('recruitment_statuses', function (Blueprint $t) {
            $t->string('main_state', 20)->default('in_progress');
        });
        DB::table('recruitment_statuses')->where('code', 'new')->update(['main_state' => 'new']);
        DB::table('recruitment_statuses')->whereIn('code', ['hired', 'rejected'])->update(['main_state' => 'finished']);
        foreach ([
            ['new_complete', 'Nowy kompletny', 'New · complete', 'new'], ['new_incomplete', 'Nowy niekompletny', 'New · incomplete', 'new'],
            ['preliminary', 'Wstępna weryfikacja', 'Preliminary review', 'in_progress'], ['rejected_preliminary', 'Odrzucony po wstępnej weryfikacji', 'Rejected after preliminary review', 'finished'],
            ['qualified', 'Zakwalifikowany do dalszej rekrutacji', 'Qualified for recruitment', 'in_progress'], ['interview_planning', 'Planowanie rozmowy', 'Interview planning', 'in_progress'],
            ['interview_scheduled', 'Rozmowa zaplanowana', 'Interview scheduled', 'in_progress'], ['interview_completed', 'Rozmowa odbyta', 'Interview completed', 'in_progress'],
            ['rejected_interview', 'Odrzucony po rozmowie', 'Rejected after interview', 'finished'],
            ['selection', 'Zakwalifikowany do wyboru', 'Qualified for selection', 'in_progress'], ['offer_made', 'Złożona propozycja', 'Offer made', 'in_progress'],
            ['withdrawn', 'Rezygnacja kandydata', 'Candidate withdrew', 'finished'], ['offer_accepted', 'Zgoda kandydata', 'Offer accepted', 'in_progress'],
            ['board_request', 'Wysłanie wniosku do Zarządu', 'Request sent to Board', 'in_progress'], ['board_approved', 'Akceptacja wniosku przez Zarząd', 'Board approved', 'finished'],
        ] as $i => $s) {
            DB::table('recruitment_statuses')->insert(['code' => $s[0], 'label_pl' => $s[1], 'label_en' => $s[2], 'main_state' => $s[3], 'color' => $s[3] === 'finished' ? '#64748b' : ($s[3] === 'new' ? '#0891b2' : '#4f46e5'), 'sort_order' => $i + 10, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        Schema::table('candidates', function (Blueprint $t) {
            $t->boolean('hr_support_required')->default(false);
            $t->boolean('qualification_required')->default(false);
            $t->boolean('future_consent')->default(false);
            $t->timestampTz('consent_recorded_at')->nullable();
            $t->text('consent_evidence')->nullable();
            $t->timestampTz('completed_at')->nullable()->index();
            $t->timestampTz('interview_at')->nullable();
            $t->string('interview_format', 20)->nullable();
            $t->text('rejection_reason')->nullable();
            $t->unsignedInteger('process_version')->default(1);
        });
        // Existing finished records need human confirmation of the completion date. Do not invent it.
        Schema::create('recruitment_dictionaries', function (Blueprint $t) {
            $t->id();
            $t->string('kind', 20);
            $t->string('code', 50);
            $t->string('label_pl', 150);
            $t->string('label_en', 150);
            $t->boolean('is_active')->default(true);
            $t->timestampsTz();
            $t->unique(['kind', 'code']);
        });
        foreach ([['event', 'phone', 'Rozmowa telefoniczna', 'Phone call'], ['event', 'email_sent', 'Wysłanie maila', 'Email sent'], ['event', 'email_received', 'Odpowiedź mailowa', 'Email received'], ['event', 'video', 'Rozmowa video', 'Video interview'], ['event', 'onsite', 'Rozmowa stacjonarna', 'In-person interview'], ['purpose', 'schedule_interview', 'Umówienie rozmowy', 'Schedule interview'], ['purpose', 'schedule_second', 'Umówienie drugiej rozmowy', 'Schedule second interview'], ['purpose', 'rejection', 'Odpowiedź odmowna', 'Rejection response']] as $d) {
            DB::table('recruitment_dictionaries')->insert(['kind' => $d[0], 'code' => $d[1], 'label_pl' => $d[2], 'label_en' => $d[3], 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        foreach (['application_contacts', 'application_notes', 'qualification_reviews', 'application_grants'] as $name) {
            Schema::create($name, function (Blueprint $t) use ($name) {
                $t->id();
                $t->foreignUuid('candidate_id')->constrained('candidates')->cascadeOnDelete();
                $t->foreignUuid('actor_id')->nullable()->constrained('demo_employees')->nullOnDelete();
                $t->string('actor_label', 150);
                $t->string('process_status', 50);
                $t->timestampsTz();
                if ($name === 'application_contacts') {
                    $t->foreignUuid('message_id')->nullable()->constrained('application_messages')->nullOnDelete();
                    $t->string('event_code', 50);
                    $t->string('purpose_code', 50)->nullable();
                    $t->string('phone_outcome', 20)->nullable();
                    $t->text('content')->nullable();
                    $t->timestampTz('occurred_at');
                    $t->string('origin', 20)->default('manual');
                }
                if ($name === 'application_notes') {
                    $t->text('content');
                }
                if ($name === 'qualification_reviews') {
                    $t->foreignUuid('reviewer_id')->constrained('demo_employees')->restrictOnDelete();
                    $t->string('stage', 20);
                    $t->string('decision', 20)->default('pending');
                    $t->text('opinion')->nullable();
                    $t->timestampTz('decided_at')->nullable();
                    $t->unsignedInteger('version')->default(1);
                }
                if ($name === 'application_grants') {
                    $t->foreignUuid('employee_id')->constrained('demo_employees')->cascadeOnDelete();
                    $t->string('grant_kind', 20);
                    $t->timestampTz('expires_at')->nullable();
                    $t->unique(['candidate_id', 'employee_id']);
                }
            });
        }
        Schema::create('recruitment_notifications', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('employee_id')->constrained('demo_employees')->cascadeOnDelete();
            $t->foreignUuid('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $t->string('kind', 50);
            $t->timestampTz('read_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('intake_envelopes', function (Blueprint $t) {
            $t->id();
            $t->string('provider_message_id', 255)->unique();
            $t->string('fingerprint', 64);
            $t->string('sender', 254);
            $t->string('subject', 255);
            $t->text('body');
            $t->string('classification', 20)->default('pending');
            $t->foreignUuid('candidate_id')->nullable()->constrained('candidates')->nullOnDelete();
            $t->timestampsTz();
        });
        Schema::create('application_attachments', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('candidate_id')->nullable()->constrained('candidates')->cascadeOnDelete();
            $t->foreignId('envelope_id')->nullable()->constrained('intake_envelopes')->cascadeOnDelete();
            $t->string('storage_key');
            $t->string('filename');
            $t->string('mime', 100);
            $t->unsignedInteger('size');
            $t->timestampsTz();
        });
        Schema::create('file_deletions', function (Blueprint $t) {
            $t->id();
            $t->string('storage_key');
            $t->timestampsTz();
        });
        $all = ['applications.view', 'applications.edit_status', 'applications.edit_notes', 'applications.edit_position', 'applications.assign_branch', 'cv.view', 'cv.upload', 'intake.create', 'correspondence.view', 'correspondence.draft', 'tasks.view', 'tasks.manage', 'tasks.complete', 'work.assign', 'process.manage', 'contacts.create', 'notes.create', 'qualification.request', 'correspondence.send'];
        foreach (['hr_manager', 'branch_manager'] as $code) {
            $role = DB::table('recruitment_roles')->where('code', $code)->first();
            if (! $role) {
                continue;
            }$p = json_decode($role->permissions, true);
            DB::table('recruitment_roles')->where('code', $code)->update(['permissions' => json_encode(array_values(array_unique(array_merge($p, $all))))]);
        }
        // Granting per-record access is proposed, opt-in policy; HR support remains record-scoped.
        foreach ([['deputy_director', 'Zastępca dyrektora', 'Deputy director', $all], ['hr_support', 'Wsparcie koordynatora HR', 'HR coordinator support', $all], ['specialist_director', 'Dyrektor Nadzoru/OŚ', 'Qualification director', ['applications.view', 'cv.view', 'notes.create', 'qualification.decide']]] as $role) {
            DB::table('recruitment_roles')->insert(['code' => $role[0], 'label_pl' => $role[1], 'label_en' => $role[2], 'scope' => 'assigned', 'permissions' => json_encode($role[3]), 'is_builtin' => true, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        foreach ([['deputy_director', 'Demo Deputy', 'deputy.p01@example.com'], ['hr_support', 'Demo HR Support', 'support.p01@example.com'], ['specialist_director', 'Demo Qualifications Director', 'qualifications.p01@example.com']] as $e) {
            DB::table('demo_employees')->insert(['id' => (string) Str::uuid(), 'role_code' => $e[0], 'name' => $e[1], 'email' => $e[2], 'is_active' => true, 'is_demo' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        DB::table('recruitment_roles')->where('code', 'hr_manager')->update(['label_pl' => 'Koordynator HR', 'label_en' => 'HR Coordinator']);
        DB::table('recruitment_roles')->where('code', 'branch_manager')->update(['label_pl' => 'Dyrektor jednostki', 'label_en' => 'Unit Director']);
    }

    public function down(): void
    {
        throw new RuntimeException('Restore a reviewed backup; P01 contains recruitment records.');
    }
};
