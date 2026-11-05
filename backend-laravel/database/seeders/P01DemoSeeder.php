<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class P01DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Fictional demo data is local/testing only.');
        }
        DB::transaction(function () {
            foreach (['Warszawa', 'Kraków', 'Gdańsk'] as $i => $city) {
                $b = Branch::withoutGlobalScopes()->firstOrCreate(['code' => 'demo-unit-'.($i + 1)], ['name' => 'SEKA '.$city, 'city' => $city, 'unit_type' => 'branch']);
                DemoEmployee::firstOrCreate(['email' => 'director.p01.'.($i + 1).'@example.com'], ['name' => 'Demo Director · '.$city, 'role_code' => 'branch_manager', 'branch_id' => $b->id, 'is_active' => true, 'is_demo' => true]);
            }
            $rows = [['anna.p01@example.com', 'Anna', 'Kowalska', 'Warszawa', 'Koordynator szkoleń', 'preliminary'], ['michal.p01@example.com', 'Michał', 'Nowak', 'Kraków', 'Specjalista ds. BHP', 'interview_planning'], ['anna.p01@example.com', 'Anna', 'Kowalska', 'Gdańsk', 'Administracja', 'new_incomplete'], ['karolina.p01@example.com', 'Karolina', 'Wiśniewska', 'Warszawa', 'Obsługa klienta', 'qualified'], ['piotr.p01@example.com', 'Piotr', 'Zieliński', 'Gdańsk', 'Specjalista ds. szkoleń', 'offer_made']];
            foreach ($rows as [$email,$first,$last,$city,$position,$status]) {
                Candidate::withoutGlobalScopes()->firstOrCreate(['email' => $email, 'position' => $position, 'source' => 'p01_demo'], ['first_name' => $first, 'last_name' => $last, 'branch_id' => Branch::withoutGlobalScopes()->where('code', 'like', 'demo-unit-%')->where('city', $city)->value('id'), 'status' => $status, 'email_subject' => 'Spontaniczna aplikacja · '.$position, 'email_body' => 'Dzień dobry, interesuje mnie praca w SEKA. To fikcyjny przykład.']);
            }
            DB::table('intake_envelopes')->insertOrIgnore(['provider_message_id' => 'demo-p01-envelope', 'fingerprint' => hash('sha256', 'demo'), 'sender' => 'ewa.p01@example.com', 'subject' => 'Aplikacja spontaniczna — szkolenia, Warszawa', 'body' => "Dzień dobry,\nchciałabym dołączyć do zespołu szkoleń w Warszawie.\nImię: Ewa\nNazwisko: Nowicka\nStanowisko: Koordynator szkoleń", 'classification' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        });
    }
}
