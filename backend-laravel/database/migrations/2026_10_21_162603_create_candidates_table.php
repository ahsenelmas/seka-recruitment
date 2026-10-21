<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidates', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 254)->index();
            $table->string('phone', 30)->nullable();

            $table->string('position', 150)->nullable()->index();

            $table->foreignId('branch_id')
                ->nullable()
                ->constrained('branches')
                ->restrictOnDelete();

            $table->enum('status', [
                'new',
                'review',
                'interview',
                'hired',
                'rejected',
            ])->default('new')->index();

            $table->text('hr_notes')->default('');
            $table->string('source', 30)->default('manual');

            $table->string('email_subject', 255)->nullable();
            $table->text('email_body')->nullable();

            $table->string('cv_storage_key', 255)->nullable();
            $table->string('cv_original_filename', 255)->nullable();
            $table->string('cv_validation_error', 255)->nullable();

            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidates');
    }
};
