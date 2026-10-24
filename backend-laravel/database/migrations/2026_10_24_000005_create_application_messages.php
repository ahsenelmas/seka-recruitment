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
        Schema::create('application_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->string('direction', 10);
            $table->string('delivery_status', 20);
            $table->string('sender', 254);
            $table->string('recipient', 254);
            $table->string('subject', 255);
            $table->text('body');
            $table->string('source', 30);
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz(6);
            $table->index(['candidate_id', 'created_at']);
            $table->index(['direction', 'delivery_status']);
        });
        // Preserve the one source email already stored on each application.
        DB::table('candidates')->where(function ($query) {
            $query->whereNotNull('email_subject')->orWhereNotNull('email_body');
        })->orderBy('id')->chunk(200, function ($rows) {
            foreach ($rows as $row) {
                DB::table('application_messages')->insert([
                    'id' => (string) Str::uuid(), 'candidate_id' => $row->id,
                    'direction' => 'inbound', 'delivery_status' => 'received',
                    'sender' => $row->email, 'recipient' => 'kariera@seka.pl',
                    'subject' => $row->email_subject ?? '', 'body' => $row->email_body ?? '',
                    'source' => 'existing_source_email', 'version' => 1,
                    'created_at' => $row->created_at, 'updated_at' => $row->created_at,
                ]);
            }
        });
        foreach (DB::table('recruitment_roles')->whereIn('code', ['admin', 'hr_manager', 'branch_manager'])->get() as $role) {
            $permissions = json_decode($role->permissions, true, 512, JSON_THROW_ON_ERROR);
            $additional = $role->code === 'branch_manager' ? ['correspondence.view'] : ['correspondence.view', 'correspondence.draft'];
            DB::table('recruitment_roles')->where('code', $role->code)->update([
                'permissions' => json_encode(array_values(array_unique(array_merge($permissions, $additional))), JSON_THROW_ON_ERROR),
            ]);
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Preserve conversations and drafts with a backup or reviewed corrective migration.');
    }
};
