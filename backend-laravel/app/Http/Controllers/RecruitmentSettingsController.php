<?php

namespace App\Http\Controllers;

use App\Models\RecruitmentSetting;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RecruitmentSettingsController extends Controller
{
    private const PUBLIC_KEYS = ['azure_tenant_id', 'azure_client_id', 'azure_redirect_uri', 'ai_provider', 'ai_model'];
    private const SECRET_KEYS = ['azure_client_secret', 'ai_api_key'];

    public function show(): JsonResponse
    {
        $data = [];
        foreach (self::PUBLIC_KEYS as $key) $data[$key] = RecruitmentSetting::find($key)?->value ?? '';
        // Do not decrypt or return secret values.
        foreach (self::SECRET_KEYS as $key) $data[$key.'_configured'] = RecruitmentSetting::whereKey($key)->whereNotNull('value')->exists();
        return response()->json($data + ['integration_connected' => false]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'azure_tenant_id' => ['sometimes', 'nullable', 'uuid'],
            'azure_client_id' => ['sometimes', 'nullable', 'uuid'],
            'azure_redirect_uri' => ['sometimes', 'nullable', 'url:http,https', 'max:500'],
            'ai_provider' => ['sometimes', 'nullable', 'string', 'max:100'],
            'ai_model' => ['sometimes', 'nullable', 'string', 'max:100'],
            'azure_client_secret' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'ai_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'clear_azure_client_secret' => ['sometimes', 'boolean'],
            'clear_ai_api_key' => ['sometimes', 'boolean'],
        ]);
        foreach (self::SECRET_KEYS as $key) abort_if(! empty($data['clear_'.$key]) && ! empty($data[$key]), 422, 'Do not replace and clear the same secret.');
        DB::transaction(function () use ($data) {
            foreach (self::PUBLIC_KEYS as $key) {
                if (array_key_exists($key, $data)) RecruitmentSetting::updateOrCreate(['key' => $key], ['value' => $data[$key]]);
            }
            foreach (self::SECRET_KEYS as $key) {
                if (! empty($data['clear_'.$key])) RecruitmentSetting::whereKey($key)->delete();
                elseif (isset($data[$key]) && $data[$key] !== '') RecruitmentSetting::updateOrCreate(['key' => $key], ['value' => $data[$key]]);
            }
        });
        return $this->show();
    }
}
