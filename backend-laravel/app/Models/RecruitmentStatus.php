<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecruitmentStatus extends Model
{
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'label_pl', 'label_en', 'color', 'sort_order', 'is_active'];
    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }
}
