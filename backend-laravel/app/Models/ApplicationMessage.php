<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ApplicationMessage extends Model
{
    use HasUuids;
    protected $fillable = ['id', 'candidate_id', 'direction', 'delivery_status', 'sender', 'recipient', 'subject', 'body', 'source', 'version'];
    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
