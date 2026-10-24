<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->string('type', 50);
            $table->string('actor_role', 50);
            $table->boolean('simulated')->default(false);
            $table->json('changes');
            $table->timestampTz('created_at', 6);
            $table->index(['candidate_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_events');
    }
};
