<?php

namespace App\Support;

use App\Models\Branch;
use App\Models\DemoEmployee;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class EntraIdentity
{
    public static function claims(string $jwt, string $nonce): array
    {
        $tenant = config('p01.entra_tenant');
        $client = config('p01.entra_client');
        abort_unless(Str::isUuid($tenant) && Str::isUuid($client), 503, 'Set the Entra tenant and client configuration.');
        $url = "https://login.microsoftonline.com/$tenant/discovery/v2.0/keys";
        $keys = Cache::remember('seka-jwks-'.$tenant, 3600, fn () => Http::timeout(10)->get($url)->throw()->json());
        try {
            $claims = (array) JWT::decode($jwt, JWK::parseKeySet($keys, 'RS256'));
        } catch (\Throwable $e) {
            Cache::forget('seka-jwks-'.$tenant);
            abort(401, 'Invalid identity token. Sign in again.');
        }
        abort_unless(($claims['iss'] ?? '') === "https://login.microsoftonline.com/$tenant/v2.0" && ($claims['aud'] ?? '') === $client && ($claims['tid'] ?? '') === $tenant && hash_equals($nonce, (string) ($claims['nonce'] ?? '')) && Str::isUuid($claims['oid'] ?? '') && isset($claims['exp']) && $claims['exp'] > time() && ($claims['iat'] ?? 0) <= time() + 60 && ($claims['ver'] ?? '') === '2.0', 401, 'Invalid identity claims.');

        return $claims;
    }

    public static function employee(array $claims): DemoEmployee
    {
        $roles = [];
        $units = [];
        foreach (($claims['roles'] ?? []) as $name) {
            if (isset(config('p01.azure_roles')[$name])) {
                $roles[] = config('p01.azure_roles')[$name];
            }if (str_starts_with($name, 'SEKA.Unit.')) {
                $units[] = substr($name, 10);
            }
        }
        $roles = array_values(array_unique($roles));
        abort_unless(count($roles) === 1, 403, 'Assign exactly one SEKA business role in Azure.');
        $code = $roles[0];
        $branch = null;
        if ($code === 'branch_manager') {
            abort_unless(count($units) === 1, 403, 'One Azure organisational unit is required.');
            $branch = Branch::withoutGlobalScopes()->where('code', $units[0])->value('id');
            abort_unless($branch, 403, 'Azure unit has no configured dictionary match.');
        }

        return DemoEmployee::updateOrCreate(['azure_oid' => $claims['oid'], 'azure_tid' => $claims['tid']], ['name' => mb_substr($claims['name'] ?? 'SEKA employee', 0, 120), 'email' => $claims['preferred_username'] ?? ($claims['oid'].'@identity.invalid'), 'role_code' => $code, 'branch_id' => $branch, 'is_active' => true, 'is_demo' => false])->load('role');
    }

    public static function resolve(Request $r): DemoEmployee
    {
        $token = $r->cookie('seka_session');
        abort_unless(is_string($token) && strlen($token) === 64, 401, 'Sign in with Microsoft.');
        $s = DB::table('seka_auth_sessions')->where('token_hash', hash('sha256', $token))->where('expires_at', '>', now())->first();
        abort_unless($s, 401, 'Session expired.');
        $e = DemoEmployee::with('role')->whereKey($s->employee_id)->where('is_demo', false)->where('is_active', true)->first();
        abort_unless($e?->role?->is_active, 403);
        if (! in_array($r->method(), ['GET', 'HEAD', 'OPTIONS'])) {
            abort_unless(rtrim((string) $r->header('Origin'), '/') === rtrim(config('p01.frontend_url'), '/'), 403, 'Untrusted request origin.');
        }

        return $e;
    }
}
