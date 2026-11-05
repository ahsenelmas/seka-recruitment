<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait ScopesDemoBranch
{
    protected static function bootScopesDemoBranch(): void
    {
        static::addGlobalScope('seka_demo_branch', function (Builder $builder) {
            if (request()->attributes->get('seka_demo_scope') === 'assigned') {
                if ($builder->getModel()->getTable() === 'candidates') {
                    $employee = request()->attributes->get('seka_demo_employee');
                    $builder->whereExists(function ($q) use ($employee) {
                        $q->selectRaw('1')->from('application_grants')->whereColumn('application_grants.candidate_id', 'candidates.id')->where('employee_id', $employee?->id ?? '')->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
                    });
                } else {
                    $builder->whereRaw('1 = 0');
                }

                return;
            }
            if (request()->attributes->get('seka_demo_scope') !== 'branch') {
                return;
            }

            $branchId = request()->attributes->get('seka_demo_branch_id');
            $model = $builder->getModel();
            $column = $model->getTable() === 'branches' ? 'id' : 'branch_id';
            $builder->where($model->qualifyColumn($column), $branchId);
        });
    }
}
