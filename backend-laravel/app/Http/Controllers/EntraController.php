<?php

namespace App\Http\Controllers;

use App\Support\EntraIdentity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class EntraController extends Controller
{
    public function config()
    {
        return response()->json(['mode' => config('p01.auth_mode'), 'demo_allowed' => app()->environment(['local', 'testing']) || config('p01.allow_demo')]);
    }

    public function start()
    {
        abort_unless(config('p01.auth_mode') === 'entra', 404);
        $tenant = config('p01.entra_tenant');
        abort_unless(Str::isUuid($tenant) && Str::isUuid(config('p01.entra_client')) && config('p01.entra_secret'), 503, 'Entra configuration is missing.');
        $state = bin2hex(random_bytes(24));
        $nonce = bin2hex(random_bytes(24));
        $verifier = bin2hex(random_bytes(32));
        $q = http_build_query(['client_id' => config('p01.entra_client'), 'response_type' => 'code', 'redirect_uri' => config('p01.entra_redirect'), 'response_mode' => 'query', 'scope' => 'openid profile email', 'state' => $state, 'nonce' => $nonce, 'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), 'code_challenge_method' => 'S256']);

        return redirect("https://login.microsoftonline.com/$tenant/oauth2/v2.0/authorize?$q")->cookie('seka_oidc', Crypt::encryptString(json_encode(compact('state', 'nonce', 'verifier') + ['at' => time()])), 10, '/api/auth', null, (app()->environment('production') || request()->isSecure()), true, false, 'lax');
    }

    public function callback(Request $r)
    {
        abort_unless(config('p01.auth_mode') === 'entra', 404);
        try {
            $state = json_decode(Crypt::decryptString((string) $r->cookie('seka_oidc')), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            abort(401, 'Login state expired. Start again.');
        }
        abort_unless(($state['at'] ?? 0) > time() - 600 && hash_equals((string) $state['state'], (string) $r->query('state')) && is_string($r->query('code')), 401, 'Invalid login response.');
        $tenant = config('p01.entra_tenant');
        $data = Http::asForm()->timeout(15)->post("https://login.microsoftonline.com/$tenant/oauth2/v2.0/token", ['client_id' => config('p01.entra_client'), 'client_secret' => config('p01.entra_secret'), 'grant_type' => 'authorization_code', 'code' => $r->query('code'), 'redirect_uri' => config('p01.entra_redirect'), 'code_verifier' => $state['verifier']])->throw()->json();
        $claims = EntraIdentity::claims($data['id_token'] ?? '', $state['nonce']);
        $employee = EntraIdentity::employee($claims);
        if ($old = $r->cookie('seka_session')) {
            DB::table('seka_auth_sessions')->where('token_hash', hash('sha256', $old))->delete();
        }
        $token = bin2hex(random_bytes(32));
        $expires = min($claims['exp'], time() + 3600);
        DB::table('seka_auth_sessions')->insert(['token_hash' => hash('sha256', $token), 'employee_id' => $employee->id, 'expires_at' => date('Y-m-d H:i:s', $expires), 'created_at' => now(), 'updated_at' => now()]);

        return redirect(rtrim(config('p01.frontend_url'), '/').'/login?authenticated=1')->cookie('seka_session', $token, (int) floor(($expires - time()) / 60), '/api', null, (app()->environment('production') || $r->isSecure()), true, false, 'lax')->withoutCookie('seka_oidc', '/api/auth');
    }

    public function logout(Request $r)
    {
        EntraIdentity::resolve($r);
        DB::table('seka_auth_sessions')->where('token_hash', hash('sha256', (string) $r->cookie('seka_session')))->delete();

        return response()->json(['signed_out' => true])->withoutCookie('seka_session', '/api');
    }
}
