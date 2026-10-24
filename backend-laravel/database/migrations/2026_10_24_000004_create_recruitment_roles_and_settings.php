<?php

use App\Support\RecruitmentPermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recruitment_roles', function (Blueprint $table) {
            $table->string('code', 50)->primary();
            $table->string('label_pl', 100);
            $table->string('label_en', 100);
            $table->string('scope', 10);
            $table->json('permissions');
            $table->boolean('is_builtin')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
        $roles = [
            ['system_admin', 'Administrator systemu', 'System Admin', 'all', ['system.configure']],
            ['admin', 'Administrator', 'Admin', 'all', array_merge(RecruitmentPermissions::BUSINESS, ['roles.manage', 'statuses.manage'])],
            ['hr_manager', 'Menedżer HR', 'HR Manager', 'all', RecruitmentPermissions::BUSINESS],
            ['branch_manager', 'Kierownik oddziału', 'Branch Manager', 'branch', ['applications.view', 'cv.view']],
        ];
        foreach ($roles as [$code, $pl, $en, $scope, $permissions]) {
            DB::table('recruitment_roles')->insert([
                'code' => $code, 'label_pl' => $pl, 'label_en' => $en,
                'scope' => $scope, 'permissions' => json_encode($permissions, JSON_THROW_ON_ERROR),
                'is_builtin' => true, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        Schema::create('recruitment_settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->text('value')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Restore a backup or use a reviewed corrective migration to preserve roles and encrypted settings.');
    }
};
