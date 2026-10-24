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
        $workPermissions = ['tasks.view', 'tasks.manage', 'tasks.complete', 'work.assign'];
        foreach (DB::table('recruitment_roles')->whereIn('code', ['admin', 'hr_manager', 'branch_manager'])->get() as $role) {
            $permissions = json_decode($role->permissions, true, 512, JSON_THROW_ON_ERROR);
            DB::table('recruitment_roles')->where('code', $role->code)->update(['permissions' => json_encode(array_values(array_unique(array_merge($permissions, $role->code === 'branch_manager' ? ['tasks.view'] : $workPermissions))), JSON_THROW_ON_ERROR)]);
        }
        if (! DB::table('recruitment_roles')->where('code', 'demo_assistant')->exists()) {
            DB::table('recruitment_roles')->insert([
                'code' => 'demo_assistant', 'label_pl' => 'Asystent demonstracyjny', 'label_en' => 'Demo Assistant',
                'scope' => 'branch', 'permissions' => json_encode(['applications.view', 'applications.edit_notes', 'correspondence.view', 'tasks.view', 'tasks.complete'], JSON_THROW_ON_ERROR),
                'is_builtin' => false, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        Schema::create('demo_employees', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->string('name', 120); $table->string('email', 254)->unique();
            $table->string('role_code', 50); $table->foreign('role_code')->references('code')->on('recruitment_roles')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('is_active')->default(true); $table->boolean('is_demo')->default(true); $table->timestampsTz();
        });
        $employees = [
            ['Demo HR', 'hr.demo@example.com', 'hr_manager', null],
            ['Demo Admin', 'admin.demo@example.com', 'admin', null],
            ['Demo System Admin', 'system.demo@example.com', 'system_admin', null],
        ];
        foreach (DB::table('branches')->orderBy('id')->get() as $branch) {
            $employees[] = ['Demo Manager · '.$branch->city, 'manager.'.$branch->id.'@example.com', 'branch_manager', $branch->id];
            $employees[] = ['Demo Assistant · '.$branch->city, 'assistant.'.$branch->id.'@example.com', 'demo_assistant', $branch->id];
        }
        foreach ($employees as [$name, $email, $role, $branch]) {
            DB::table('demo_employees')->insert(['id' => (string) Str::uuid(), 'name' => $name, 'email' => $email, 'role_code' => $role, 'branch_id' => $branch, 'is_active' => true, 'is_demo' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        Schema::table('candidates', function (Blueprint $table) {
            $table->foreignUuid('owner_employee_id')->nullable()->constrained('demo_employees')->nullOnDelete();
            $table->date('follow_up_on')->nullable(); $table->unsignedInteger('work_version')->default(1);
        });
        Schema::create('application_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->foreignUuid('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->foreignUuid('assignee_employee_id')->nullable()->constrained('demo_employees')->nullOnDelete();
            $table->string('title', 180); $table->text('description')->nullable(); $table->date('due_on')->nullable();
            $table->string('status', 20)->default('open'); $table->unsignedInteger('version')->default(1);
            $table->timestampTz('completed_at')->nullable(); $table->timestampsTz();
            $table->index(['candidate_id', 'status']); $table->index(['assignee_employee_id', 'status', 'due_on']);
        });
    }
    public function down(): void
    {
        throw new RuntimeException('Preserve ownership/tasks with a backup or reviewed corrective migration.');
    }
};
