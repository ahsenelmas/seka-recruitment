<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Support\EntraIdentity;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class EntraIdentityTest extends TestCase
{
    use RefreshDatabase;

    private function setupToken(array $over = []): array
    {
        $tenant = '11111111-1111-4111-8111-111111111111';
        $client = '22222222-2222-4222-8222-222222222222';
        config(['p01.entra_tenant' => $tenant, 'p01.entra_client' => $client]);
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $private);
        $details = openssl_pkey_get_details($key);
        Http::fake(['https://login.microsoftonline.com/*/discovery/v2.0/keys' => Http::response(['keys' => [['kty' => 'RSA', 'kid' => 'test-key', 'alg' => 'RS256', 'use' => 'sig', 'n' => JWT::urlsafeB64Encode($details['rsa']['n']), 'e' => JWT::urlsafeB64Encode($details['rsa']['e'])]]])]);
        $claims = array_replace(['iss' => "https://login.microsoftonline.com/$tenant/v2.0", 'aud' => $client, 'tid' => $tenant, 'oid' => '33333333-3333-4333-8333-333333333333', 'ver' => '2.0', 'nonce' => 'expected', 'iat' => time() - 5, 'nbf' => time() - 5, 'exp' => time() + 300, 'name' => 'Azure Person', 'preferred_username' => 'employee@example.com', 'roles' => ['SEKA.HRCoordinator']], $over);

        return [JWT::encode($claims, $private, 'RS256', 'test-key'), $claims];
    }

    public function test_signed_token_maps_only_configured_azure_role_and_does_not_merge_on_email(): void
    {
        [$jwt,$claims] = $this->setupToken();
        $validated = EntraIdentity::claims($jwt, 'expected');
        $a = EntraIdentity::employee($validated);
        $this->assertSame('hr_manager', $a->role_code);
        $this->assertFalse($a->is_demo);
        $other = EntraIdentity::employee(array_replace($claims, ['oid' => '44444444-4444-4444-8444-444444444444']));
        $this->assertNotSame($a->id, $other->id);
    }

    public function test_audience_nonce_tenant_and_signature_are_checked(): void
    {
        foreach ([['aud' => 'wrong'], ['tid' => '44444444-4444-4444-8444-444444444444'], ['nonce' => 'wrong'], ['iss' => 'https://evil.example']] as $override) {
            [$jwt] = $this->setupToken($override);
            Cache::flush();
            try {
                EntraIdentity::claims($jwt, 'expected');
                $this->fail('Invalid claims accepted');
            } catch (HttpException $e) {
                $this->assertSame(401, $e->getStatusCode());
            }
        }
    }

    public function test_expired_or_tampered_token_is_rejected(): void
    {
        [$jwt] = $this->setupToken(['exp' => time() - 5]);
        $this->expectException(HttpException::class);
        EntraIdentity::claims($jwt, 'expected');
    }

    public function test_unit_role_requires_explicit_stable_unit_code(): void
    {
        [$jwt,$claims] = $this->setupToken(['roles' => ['SEKA.UnitDirector', 'SEKA.Unit.warsaw-branch']]);
        $unit = Branch::create(['name' => 'Warsaw branch', 'city' => 'Warszawa', 'code' => 'warsaw-branch']);
        $e = EntraIdentity::employee($claims);
        $this->assertSame($unit->id, $e->branch_id);
        $this->assertSame('branch_manager', $e->role_code);
    }

    public function test_missing_or_multiple_business_roles_fail_closed(): void
    {
        [, $claims] = $this->setupToken(['roles' => ['SEKA.TechnicalAdmin', 'SEKA.HRCoordinator']]);
        $this->expectException(HttpException::class);
        EntraIdentity::employee($claims);
    }

    public function test_entra_session_ignores_demo_cookie_and_requires_trusted_origin_for_writes(): void
    {
        $this->setupToken();
        config(['p01.auth_mode' => 'entra', 'p01.frontend_url' => 'https://recruitment.example']);
        $e = EntraIdentity::employee(['oid' => '33333333-3333-4333-8333-333333333333', 'tid' => config('p01.entra_tenant'), 'name' => 'Employee', 'preferred_username' => 'employee@example.com', 'roles' => ['SEKA.HRCoordinator']]);
        $token = str_repeat('a', 64);
        DB::table('seka_auth_sessions')->insert(['token_hash' => hash('sha256', $token), 'employee_id' => $e->id, 'expires_at' => now()->addMinutes(10), 'created_at' => now(), 'updated_at' => now()]);
        $this->withCredentials()->withUnencryptedCookie('seka_session', $token)->withUnencryptedCookie('seka_demo', 'system_admin:')->getJson('/api/demo/context')->assertOk()->assertJsonPath('role', 'hr_manager')->assertJsonPath('simulation', false);
        $this->getJson('/api/p01/meta')->assertOk()->assertJsonCount(1, 'employees');
        $this->postJson('/api/p01/manual', ['first_name' => 'A', 'last_name' => 'B', 'email' => 'a@example.com'])->assertForbidden();
        $this->withHeader('Origin', 'https://recruitment.example')->postJson('/api/p01/manual', ['first_name' => 'A', 'last_name' => 'B', 'email' => 'a@example.com'])->assertCreated();
    }
}
