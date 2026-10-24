<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Applicant extends Model
{
    use HasUuids;

    protected $fillable = ['email'];

    // Candidate remains the legacy name for an individual submission.
    public function applications(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }
}
