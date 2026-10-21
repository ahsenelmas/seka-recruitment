<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait ScopesDemoBranch
{
    protected static function bootScopesDemoBranch(): void
    {
        static::addGlobalScope('seka_demo_branch', function (Builder $builder) {
            if (request()->attributes->get('seka_demo_role') !== 'branch_manager') {
                return;
            }

            $branchId = request()->attributes->get('seka_demo_branch_id');
            $model = $builder->getModel();
            $column = $model->getTable() === 'branches' ? 'id' : 'branch_id';
            $builder->where($model->qualifyColumn($column), $branchId);
        });
    }
}
