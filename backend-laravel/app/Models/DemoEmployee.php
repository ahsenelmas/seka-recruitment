<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class DemoEmployee extends Model
{
    use HasUuids;
    protected $guarded = [];
    protected function casts(): array { return ['is_active' => 'boolean', 'is_demo' => 'boolean']; }
    public function role(): \Illuminate\Database\Eloquent\Relations\BelongsTo { return $this->belongsTo(RecruitmentRole::class, 'role_code', 'code'); }
    public function branch(): \Illuminate\Database\Eloquent\Relations\BelongsTo { return $this->belongsTo(Branch::class); }
}
