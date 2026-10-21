<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    protected $fillable = [
        'city',
        'name',
    ];

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }
}
