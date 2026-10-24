<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Candidate;
use App\Support\IntakeSuggestions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class IntakePreviewTest extends TestCase
{
    use RefreshDatabase;

    private function input(array $extra = []): array
    {
        return array_replace([
            'email' => 'anna@example.com', 'email_subject' => 'Spontaneous application',
            'email_body' => "Imię: Anna\r\nNazwisko: Kowalska\r\nStanowisko: Training coordinator\r\nMiasto: Warszawa",
        ], $extra);
    }

    public function test_preview_suggests_explicit_details_without_saving(): void
    {
        Storage::fake('local');
        $branch = Branch::create(['city' => 'Warszawa', 'name' => 'SEKA Warszawa']);
        $this->postJson('/api/intake/preview', $this->input())
            ->assertOk()->assertJsonPath('suggestions.first_name.value', 'Anna')
            ->assertJsonPath('suggestions.branch_id.value', (string) $branch->id)
            ->assertJsonPath('suggestions.position.source', 'email')
            ->assertJsonPath('cv_status', 'missing')->assertJsonPath('needs_review', true);
        $this->assertSame(0, Candidate::withoutGlobalScopes()->count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_multiple_cities_are_not_automatically_assigned(): void
    {
        Branch::create(['city' => 'Warszawa', 'name' => 'SEKA Warszawa']);
        Branch::create(['city' => 'Kraków', 'name' => 'SEKA Kraków']);
        $this->postJson('/api/intake/preview', $this->input(['email_body' => 'Warszawa lub Krakow']))
            ->assertOk()->assertJsonPath('suggestions.branch_id', null)
            ->assertJsonFragment(['ambiguous_branch_id']);
    }

    public function test_pdf_can_supply_details_without_storing_the_document(): void
    {
        Storage::fake('local');
        Branch::create(['city' => 'Warszawa', 'name' => 'SEKA Warszawa']);
        $file = UploadedFile::fake()->createWithContent('cv.pdf', file_get_contents(base_path('tests/Fixtures/intake-readable.pdf')));
        $this->postJson('/api/intake/preview', $this->input(['email_body' => 'Please review my attached CV.', 'file' => $file]))
            ->assertOk()->assertJsonPath('cv_status', 'readable')
            ->assertJsonPath('suggestions.last_name.value', 'Kowalska')
            ->assertJsonPath('suggestions.last_name.source', 'cv');
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertSame(0, Candidate::withoutGlobalScopes()->count());
    }

    public function test_invalid_attachment_does_not_remove_email_suggestions(): void
    {
        $this->postJson('/api/intake/preview', $this->input(['file' => UploadedFile::fake()->createWithContent('broken.pdf', 'not a pdf')]))
            ->assertOk()->assertJsonPath('cv_status', 'unreadable')
            ->assertJsonPath('suggestions.first_name.value', 'Anna');
    }

    public function test_branch_manager_cannot_preview_and_real_email_is_rejected(): void
    {
        $branch = Branch::create(['city' => 'Warszawa', 'name' => 'SEKA Warszawa']);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$branch->id)
            ->postJson('/api/intake/preview', $this->input())->assertForbidden();
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'hr_manager:')
            ->postJson('/api/intake/preview', $this->input(['email' => 'anna@company.pl']))->assertUnprocessable();
    }

    public function test_conflicting_sources_and_unlabelled_names_are_not_guessed(): void
    {
        $result = (new IntakeSuggestions())->extract(['email' => "First name: Anna\nAnna Kowalska", 'cv' => 'First name: Maria'], []);
        $this->assertNull($result['suggestions']['first_name']);
        $this->assertContains('ambiguous_first_name', $result['issues']);
        $this->assertNull($result['suggestions']['last_name']);
    }
}
