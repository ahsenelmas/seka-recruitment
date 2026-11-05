<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FileCleanup
{
    public static function run(): int
    {
        $removed = 0;
        foreach (DB::table('file_deletions')->orderBy('id')->limit(200)->get() as $row) {
            try {
                if (Storage::disk('local')->exists($row->storage_key) && ! Storage::disk('local')->delete($row->storage_key)) {
                    continue;
                }DB::table('file_deletions')->where('id', $row->id)->delete();
                $removed++;
            } catch (\Throwable) {/* Retry later; never lose the durable deletion request. */
            }
        }

        return $removed;
    }
}
