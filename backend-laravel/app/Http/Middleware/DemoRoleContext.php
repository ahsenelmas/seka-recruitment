<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Local demo only: the selectable cookie is NOT a verified user identity. */
class DemoRoleContext
{
    public function handle(Request $request, Closure $next): Response
    {
        // Let the demo selector recover from an invalid cookie.
        $selection = $request->is('api/demo/context') && $request->isMethod('POST');
        $raw = $selection ? 'hr_manager:' : $request->cookie('seka_demo', 'hr_manager:');
        $parts = is_string($raw) ? explode(':', $raw, 2) : [];
        $role = $parts[0] ?? '';
        $branch = $parts[1] ?? '';

        if (count($parts) !== 2 || ! in_array($role, ['admin', 'hr_manager', 'branch_manager'], true)) {
            return response()->json(['message' => 'Wybierz ponownie rolę demonstracyjną.'], 400);
        }

        $branchId = null;
        if ($role === 'branch_manager') {
            if (! ctype_digit($branch) || (int) $branch <= 0) {
                return response()->json(['message' => 'Wybierz prawidłowy oddział.'], 400);
            }
            $branchId = (int) $branch;
            if (! Branch::withoutGlobalScopes()->whereKey($branchId)->exists()) {
                return response()->json(['message' => 'Nie znaleziono oddziału.'], 400);
            }
        } elseif ($branch !== '') {
            return response()->json(['message' => 'Nieprawidłowy kontekst roli.'], 400);
        }

        $request->attributes->set('seka_demo_role', $role);
        $request->attributes->set('seka_demo_branch_id', $branchId);

        if ($role === 'branch_manager' && ! $selection && ! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return response()->json(['message' => 'Kierownik oddziału ma dostęp tylko do odczytu.'], 403);
        }

        if ($request->is('api/demo/admin-overview') && $role !== 'admin') {
            return response()->json(['message' => 'Dostęp tylko dla administratora.'], 403);
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');
        $response->setVary('Cookie', false);
        return $response;
    }
}
