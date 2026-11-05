<?php

namespace App\Console\Commands;

use App\Support\FileCleanup;
use Illuminate\Console\Command;

class CleanupFiles extends Command
{
    protected $signature = 'seka:cleanup-files';

    protected $description = 'Retry already-authorised document deletions';

    public function handle(): int
    {
        $this->info('Processed: '.FileCleanup::run());

        return self::SUCCESS;
    }
}
