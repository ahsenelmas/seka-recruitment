<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class ApplicationTask extends Model
{
    use HasUuids;
    protected $guarded = [];
    protected function casts(): array { return ['version' => 'integer', 'due_on' => 'date:Y-m-d', 'completed_at' => 'datetime']; }
    public function candidate(): \Illuminate\Database\Eloquent\Relations\BelongsTo { return $this->belongsTo(Candidate::class); }
    public function assignee(): \Illuminate\Database\Eloquent\Relations\BelongsTo { return $this->belongsTo(DemoEmployee::class, 'assignee_employee_id'); }
}
