<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationEvent extends Model
{
    public $timestamps = false;
    protected $fillable = ['candidate_id', 'type', 'actor_role', 'simulated', 'changes', 'created_at'];
    protected function casts(): array
    {
        return ['changes' => 'array', 'simulated' => 'boolean', 'created_at' => 'immutable_datetime'];
    }
}
