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
        Schema::create('applicants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email', 254)->unique();
            $table->timestampsTz();
        });

        Schema::table('candidates', function (Blueprint $table) {
            $table->foreignUuid('applicant_id')->nullable()
                ->constrained('applicants')->restrictOnDelete();
        });

        // Keep every original submission and CV; only add a shared identity.
        DB::transaction(function () {
            DB::table('candidates')->orderBy('id')->chunk(200, function ($rows) {
                foreach ($rows as $row) {
                    $email = mb_strtolower(trim($row->email));
                    $id = DB::table('applicants')->where('email', $email)->value('id');
                    if (! $id) {
                        $id = (string) Str::uuid();
                        DB::table('applicants')->insert([
                            'id' => $id,
                            'email' => $email,
                            'created_at' => $row->created_at,
                            'updated_at' => $row->updated_at,
                        ]);
                    }
                    DB::table('candidates')->where('id', $row->id)
                        ->update(['applicant_id' => $id]);
                }
            });
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('applicant_id');
        });
        Schema::dropIfExists('applicants');
    }
};
