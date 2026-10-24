<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\RecruitmentRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Demonstration only: freely selectable roles do not establish identity. */
class DemoRoleContext
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/health') || $request->isMethod('OPTIONS')) return $next($request);
        // Login metadata and role selection must recover from an archived/invalid cookie.
        $selection = $request->is('api/demo/catalog') || ($request->is('api/demo/context', 'api/demo/employee') && $request->isMethod('POST'));
        if ($selection) {
            $response = $next($request);
            $response->headers->set('Cache-Control', 'private, no-store');
            return $response;
        }
        $employee = null;
        $employeeId = $request->cookie('seka_demo_employee');
        if ($employeeId) {
            $employee = is_string($employeeId) && \Illuminate\Support\Str::isUuid($employeeId) ? \App\Models\DemoEmployee::with('role')->whereKey($employeeId)->where('is_active', true)->where('is_demo', true)->first() : null;
            if (! $employee || ! $employee->role?->is_active) return response()->json(['message' => 'Select a demonstration account again.'], 400);
        }
        $raw = $employee ? $employee->role_code.':'.($employee->role->scope === 'branch' ? ($employee->branch_id ?? '') : '') : $request->cookie('seka_demo', 'hr_manager:');
        $parts = is_string($raw) ? explode(':', $raw, 2) : [];
        $role = count($parts) === 2 ? RecruitmentRole::whereKey($parts[0])->where('is_active', true)->first() : null;
        if (! $role) return response()->json(['message' => 'Wybierz ponownie rolę / Select a role again.'], 400);
        $branch = $parts[1];
        $branchId = null;
        if ($role->scope === 'branch') {
            if (! ctype_digit($branch) || (int) $branch <= 0 || ! Branch::withoutGlobalScopes()->whereKey((int) $branch)->exists()) {
                return response()->json(['message' => 'Wybierz prawidłowy oddział / Select a valid branch.'], 400);
            }
            $branchId = (int) $branch;
        } elseif ($branch !== '') {
            return response()->json(['message' => 'Wybierz ponownie rolę / Select a role again.'], 400);
        }
        $request->attributes->set('seka_demo_employee', $employee);
        $request->attributes->set('seka_demo_role', $role->code);
        $request->attributes->set('seka_demo_branch_id', $branchId);
        $request->attributes->set('seka_demo_scope', $role->scope);
        $request->attributes->set('seka_demo_permissions', $role->permissions);
        $request->attributes->set('seka_demo_role_definition', $role);
        $allowed = fn (string $permission): bool => in_array($permission, $role->permissions, true);
        $method = $request->isMethod('HEAD') ? 'GET' : $request->method();
        $path = trim($request->path(), '/');
        $permit = $selection || ($path === 'api/demo/context' && $method === 'GET');
        if (! $permit) {
            if ($path === 'api/tasks') $permit = $method === 'GET' && $allowed('applications.view') && $allowed('tasks.view');
            elseif (preg_match('~^api/candidates/[^/]+/work$~', $path)) $permit = $allowed('applications.view') && $allowed('tasks.view') && ($method === 'GET' || ($method === 'PATCH' && $allowed('work.assign')));
            elseif (preg_match('~^api/candidates/[^/]+/tasks(?:/[^/]+)?$~', $path)) $permit = $allowed('applications.view') && $allowed('tasks.view') && (($method === 'POST' && $allowed('tasks.manage')) || ($method === 'PATCH' && ($allowed('tasks.manage') || $allowed('tasks.complete'))));
            elseif ($path === 'api/inbox' && $method === 'GET') $permit = $allowed('applications.view') && $allowed('correspondence.view');
            elseif (preg_match('~^api/candidates/[^/]+/messages(?:/[^/]+)?$~', $path)) {
                $permit = $allowed('applications.view') && $allowed('correspondence.view') && (
                    $method === 'GET' ||
                    (($method === 'POST' || $method === 'PATCH') && $allowed('correspondence.draft'))
                );
                if (str_ends_with($path, '/messages/sample-incoming')) {
                    $permit = $method === 'POST' && $allowed('applications.view') && $allowed('correspondence.view') && $allowed('intake.create') && $role->scope === 'all';
                }
            }
            elseif ($request->is('api/admin/roles', 'api/admin/roles/*')) $permit = $allowed('roles.manage');
            elseif ($request->is('api/admin/statuses', 'api/admin/statuses/*')) $permit = $allowed('statuses.manage');
            elseif ($request->is('api/system/settings', 'api/demo/admin-overview')) $permit = $allowed('system.configure');
            elseif ($path === 'api/statuses' && $method === 'GET') $permit = $allowed('applications.view') || $allowed('statuses.manage');
            elseif ($path === 'api/intake/sample-email' && $method === 'POST') $permit = $allowed('intake.create') && $role->scope === 'all';
            elseif (preg_match('~^api/candidates/[^/]+/cv$~', $path)) {
                $permit = $allowed('applications.view') && (($method === 'GET' && $allowed('cv.view')) || ($method === 'POST' && $allowed('cv.upload')));
            } elseif ($method === 'PATCH' && preg_match('~^api/candidates/[^/]+$~', $path)) {
                $fields = ['status' => 'applications.edit_status', 'hr_notes' => 'applications.edit_notes', 'branch_id' => 'applications.assign_branch', 'position' => 'applications.edit_position'];
                $permit = $allowed('applications.view') && count($request->all()) > 0;
                foreach ($request->all() as $field => $value) {
                    if (! isset($fields[$field]) || ! $allowed($fields[$field])) $permit = false;
                }
                if ($request->exists('branch_id') && $role->scope !== 'all') $permit = false;
            } elseif ($method === 'GET' && ($request->is('api/dashboard', 'api/branches', 'api/positions', 'api/candidates', 'api/candidates/*', 'api/applicants/*'))) {
                $permit = $allowed('applications.view');
            }
        }
        if (! $permit) return response()->json(['message' => 'Brak uprawnień / Permission denied.'], 403);
        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');
        $response->setVary('Cookie', false);
        return $response;
    }
}
