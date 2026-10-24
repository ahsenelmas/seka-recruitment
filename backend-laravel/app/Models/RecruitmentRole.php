<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecruitmentRole extends Model
{
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code', 'label_pl', 'label_en', 'scope', 'permissions', 'is_builtin', 'is_active'];
    protected function casts(): array
    {
        return ['permissions' => 'array', 'is_builtin' => 'boolean', 'is_active' => 'boolean'];
    }
}
