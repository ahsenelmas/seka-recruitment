<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemoEmployee extends Model
{
    use HasUuids;

    protected static function booted(): void
    {
        static::addGlobalScope('live_directory', function ($query) {
            if (config('p01.auth_mode') === 'entra') {
                $query->where($query->getModel()->qualifyColumn('is_demo'), false);
            }
        });
    }

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_demo' => 'boolean'];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(RecruitmentRole::class, 'role_code', 'code');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
