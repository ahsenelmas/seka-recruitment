<?php

namespace App\Models;

use App\Models\Concerns\ScopesDemoBranch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    use ScopesDemoBranch;

    protected $fillable = [
        'city',
        'name', 'unit_type', 'code',
    ];

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }
}
