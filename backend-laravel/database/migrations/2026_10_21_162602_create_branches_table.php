<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('city', 100)->unique();
            $table->string('name', 150);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
