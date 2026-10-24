<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            throw new RuntimeException('This migration supports PostgreSQL and SQLite only.');
        }
        Schema::create('recruitment_statuses', function (Blueprint $table) {
            $table->string('code', 50)->primary();
            $table->string('label_pl', 100);
            $table->string('label_en', 100);
            $table->string('color', 7);
            $table->unsignedInteger('sort_order');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
        foreach ([
            ['new', 'Nowa aplikacja', 'New application', '#3b82f6'],
            ['review', 'W trakcie analizy', 'Under review', '#d97706'],
            ['interview', 'Rozmowa kwalifikacyjna', 'Interview', '#8b5cf6'],
            ['hired', 'Zatrudniony', 'Hired', '#15803d'],
            ['rejected', 'Odrzucony', 'Rejected', '#dc2626'],
        ] as $index => $status) {
            DB::table('recruitment_statuses')->insert([
                'code' => $status[0], 'label_pl' => $status[1], 'label_en' => $status[2],
                'color' => $status[3], 'sort_order' => $index,
                'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        // Laravel's PostgreSQL enum is a varchar with a CHECK constraint.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check');
        }
        Schema::table('candidates', function (Blueprint $table) {
            $table->string('status', 50)->default('new')->change();
        });
        Schema::table('candidates', function (Blueprint $table) {
            $table->foreign('status')->references('code')->on('recruitment_statuses')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        // Avoid silently losing custom labels, order, or references.
        throw new RuntimeException('Status configuration rollback requires a reviewed data migration. Restore a backup instead.');
    }
};
