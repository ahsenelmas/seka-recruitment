<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\RecruitmentRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DemoContextController extends Controller
{
    public function catalog(): JsonResponse
    {
        return response()->json([
            'roles' => RecruitmentRole::where('is_active', true)->orderBy('is_builtin', 'desc')->orderBy('code')->get(),
            'branches' => Branch::withoutGlobalScopes()->orderBy('city')->get(['id', 'city', 'name']),
            'employees' => \App\Models\DemoEmployee::where('is_demo', true)->where('is_active', true)->whereHas('role', fn ($q) => $q->where('is_active', true))->orderBy('name')->get(['id', 'name', 'email', 'role_code', 'branch_id']),
            'simulation' => true,
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'role' => $request->attributes->get('seka_demo_role'),
            'employee' => $request->attributes->get('seka_demo_employee')?->only(['id', 'name', 'email']),
            'role_definition' => $request->attributes->get('seka_demo_role_definition'),
            'permissions' => $request->attributes->get('seka_demo_permissions', []),
            'scope' => $request->attributes->get('seka_demo_scope'),
            'branch_id' => $request->attributes->get('seka_demo_branch_id'),
            'simulation' => true,
            'branches' => Branch::withoutGlobalScopes()->orderBy('city')->get(['id', 'city', 'name']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'string', Rule::exists('recruitment_roles', 'code')->where('is_active', true)],
            'branch_id' => ['nullable', 'integer', 'min:1', Rule::exists('branches', 'id')],
        ]);
        $role = RecruitmentRole::findOrFail($data['role']);
        $branch = $role->scope === 'branch' ? ($data['branch_id'] ?? null) : null;
        abort_if($role->scope === 'branch' && $branch === null, 422, 'Select a branch.');
        abort_if($role->scope === 'all' && isset($data['branch_id']), 422, 'This role has company-wide scope.');
        return response()->json([
            'role' => $role->code, 'branch_id' => $branch, 'simulation' => true,
        ])->cookie('seka_demo', $role->code.':'.($branch ?? ''), 480, '/api', null, $request->isSecure(), true, false, 'lax')->withoutCookie('seka_demo_employee', '/api');
    }

    public function employee(Request $request): JsonResponse
    {
        $data = $request->validate(['employee_id' => ['required', 'uuid']]);
        $employee = \App\Models\DemoEmployee::with('role')->whereKey($data['employee_id'])->where('is_demo', true)->where('is_active', true)->firstOrFail();
        abort_unless($employee->role?->is_active, 422, 'This role is inactive.');
        abort_if($employee->role->scope === 'branch' && ! \App\Models\Branch::withoutGlobalScopes()->whereKey($employee->branch_id)->exists(), 422, 'This account needs a valid branch.');
        $branch = $employee->role->scope === 'branch' ? $employee->branch_id : null;
        return response()->json(['role' => $employee->role_code, 'branch_id' => $branch, 'simulation' => true])->cookie('seka_demo_employee', $employee->id, 480, '/api', null, $request->isSecure(), true, false, 'lax')->cookie('seka_demo', $employee->role_code.':'.($branch ?? ''), 480, '/api', null, $request->isSecure(), true, false, 'lax');
    }

    public function adminOverview(): JsonResponse
    {
        return response()->json(['authentication' => 'demo_only', 'company_login' => 'not_connected', 'email_delivery' => 'not_configured']);
    }
}
