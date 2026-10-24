<?php

namespace App\Http\Controllers;

use App\Models\RecruitmentRole;
use App\Support\RecruitmentPermissions;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RecruitmentRoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['roles' => RecruitmentRole::orderBy('code')->get(), 'permissions' => RecruitmentPermissions::catalog()]);
    }

    private function validateRole(Request $request): array
    {
        $data = $request->validate([
            'label_pl' => ['required', 'string', 'max:100'],
            'label_en' => ['required', 'string', 'max:100'],
            'scope' => ['required', Rule::in(['all', 'branch'])],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['required', 'string', 'distinct', Rule::in(RecruitmentPermissions::BUSINESS)],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);
        abort_unless(in_array('applications.view', $data['permissions'], true), 422, 'Recruitment roles require applications.view.');
        abort_if(array_intersect(['tasks.manage', 'tasks.complete', 'work.assign'], $data['permissions']) && ! in_array('tasks.view', $data['permissions'], true), 422, 'Task actions require tasks.view.');
        abort_if(in_array('correspondence.draft', $data['permissions'], true) && ! in_array('correspondence.view', $data['permissions'], true), 422, 'Reply drafts require correspondence.view.');
        abort_if(in_array('cv.upload', $data['permissions'], true) && ! in_array('cv.view', $data['permissions'], true), 422, 'CV upload requires cv.view.');
        abort_if($data['scope'] === 'branch' && array_intersect(['intake.create', 'applications.assign_branch'], $data['permissions']), 422, 'Intake and branch reassignment require company-wide scope.');
        return $data;
    }

    public function store(Request $request): JsonResponse
    {
        $code = $request->validate(['code' => ['required', 'string', 'max:50', 'regex:/\A[a-z][a-z0-9_]*\z/', Rule::unique('recruitment_roles', 'code')]])['code'];
        $data = $this->validateRole($request);
        return response()->json(RecruitmentRole::create($data + ['code' => $code, 'is_builtin' => false]), 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $request->validate(['code' => ['prohibited'], 'is_builtin' => ['prohibited']]);
        // Protect the two administrator roles from privilege escalation and lockout.
        abort_if(in_array($code, ['admin', 'system_admin'], true), 403, 'Administrator roles are protected.');
        $data = $this->validateRole($request);
        return response()->json(DB::transaction(function () use ($code, $data) {
            $role = RecruitmentRole::whereKey($code)->lockForUpdate()->firstOrFail();
            abort_if($role->is_builtin && array_key_exists('is_active', $data) && ! $data['is_active'], 422, 'Built-in roles stay active.');
            $role->update($data);
            return $role->fresh();
        }));
    }
}
