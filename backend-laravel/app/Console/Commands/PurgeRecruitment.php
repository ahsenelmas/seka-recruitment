<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PurgeRecruitment extends Command
{
    protected $signature = 'seka:purge {--execute : Delete expired application data; dry run otherwise}';

    protected $description = 'P01 retention from recruitment completion date; deletion is opt-in.';

    public function handle(): int
    {
        $normal = (int) config('p01.retention_days');
        $consent = (int) config('p01.consent_retention_days');
        if ($normal < 1 || $consent < 1) {
            $this->warn('Set both approved retention periods. Nothing deleted.');

            return self::SUCCESS;
        }
        if ($this->option('execute') && ! config('p01.retention_enabled')) {
            $this->error('SEKA_RETENTION_ENABLED must explicitly enable deletion.');

            return self::FAILURE;
        }
        $expired = fn ($q) => $q->whereNotNull('completed_at')->whereIn('status', DB::table('recruitment_statuses')->where('main_state', 'finished')->select('code'))->where(fn ($q) => $q->where(fn ($q) => $q->where('future_consent', false)->where('completed_at', '<=', now()->subDays($normal)))->orWhere(fn ($q) => $q->where('future_consent', true)->where('completed_at', '<=', now()->subDays($consent))));
        $count = $expired(Candidate::withoutGlobalScopes())->count();
        $this->info(($this->option('execute') ? 'Eligible for deletion: ' : 'Dry run — eligible: ').$count);
        if (! $this->option('execute')) {
            return self::SUCCESS;
        }
        $expired(Candidate::withoutGlobalScopes())->chunkById(100, function ($rows) use ($expired) {
            foreach ($rows as $row) {
                DB::transaction(function () use ($row, $expired) {
                    $c = $expired(Candidate::withoutGlobalScopes()->whereKey($row->id))->lockForUpdate()->first();
                    if (! $c) {
                        return;
                    }$paths = DB::table('application_attachments')->where('candidate_id', $c->id)->pluck('storage_key')->all();
                    if ($c->cv_storage_key) {
                        $paths[] = $c->cv_storage_key;
                    }foreach (array_unique($paths) as $path) {
                        DB::table('file_deletions')->insert(['storage_key' => $path, 'created_at' => now(), 'updated_at' => now()]);
                    }$legacy = $c->applicant_id;
                    DB::table('intake_envelopes')->where('candidate_id', $c->id)->delete();
                    $c->delete();
                    if ($legacy && ! DB::table('candidates')->where('applicant_id', $legacy)->exists()) {
                        DB::table('applicants')->where('id', $legacy)->delete();
                    }
                });
            }
        });
        foreach (DB::table('file_deletions')->orderBy('id')->get() as $row) {
            try {
                if (Storage::disk('local')->exists($row->storage_key) && ! Storage::disk('local')->delete($row->storage_key)) {
                    continue;
                }DB::table('file_deletions')->where('id', $row->id)->delete();
            } catch (\Throwable) {
                $this->warn('A storage deletion is pending retry.');
            }
        }

        return self::SUCCESS;
    }
}
