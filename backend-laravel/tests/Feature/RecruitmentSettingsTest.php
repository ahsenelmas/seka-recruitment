<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RecruitmentSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_secrets_are_encrypted_and_never_returned_and_blank_keeps_value(): void
    {
        // Use a disposable test encryption key; never touch a deployed APP_KEY.
        config(['app.key' => 'base64:'.base64_encode(str_repeat('t', 32))]);
        $secret = 'fictional-key-for-unit-testing';
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'system_admin:')
            ->patchJson('/api/system/settings', ['ai_api_key' => $secret, 'ai_provider' => 'Example provider'])
            ->assertOk()->assertJsonPath('ai_api_key_configured', true)->assertJsonMissingPath('ai_api_key');
        $encrypted = DB::table('recruitment_settings')->where('key', 'ai_api_key')->value('value');
        $this->assertNotSame($secret, $encrypted);
        $this->assertStringNotContainsString($secret, $encrypted);
        $this->getJson('/api/system/settings')->assertOk()->assertJsonPath('ai_provider', 'Example provider')->assertJsonMissingPath('ai_api_key');
        $this->patchJson('/api/system/settings', ['ai_api_key' => ''])->assertOk()->assertJsonPath('ai_api_key_configured', true);
        $this->patchJson('/api/system/settings', ['clear_ai_api_key' => true])->assertOk()->assertJsonPath('ai_api_key_configured', false);
    }

    public function test_non_system_roles_cannot_read_or_write_settings(): void
    {
        foreach (['admin', 'hr_manager'] as $role) {
            $this->withCredentials()->withUnencryptedCookie('seka_demo', $role.':')
                ->getJson('/api/system/settings')->assertForbidden();
            $this->patchJson('/api/system/settings', ['ai_api_key' => 'forbidden'])->assertForbidden();
        }
    }
}
