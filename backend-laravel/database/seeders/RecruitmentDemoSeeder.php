<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Candidate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RecruitmentDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (
            ! app()->environment('local')
            || DB::selectOne('select current_database() as name')->name
                !== 'seka_laravel_dev'
        ) {
            throw new \RuntimeException(
                'Seeder wymaga środowiska local i bazy seka_laravel_dev.'
            );
        }

        DB::transaction(function () {
            $rows = [
                ['Warszawa', 'Anna', 'Kowalska', 'new'],
                ['Kraków', 'Jan', 'Nowak', 'review'],
                ['Wrocław', 'Maria', 'Wiśniewska', 'interview'],
                ['Gdańsk', 'Piotr', 'Zieliński', 'hired'],
                ['Poznań', 'Katarzyna', 'Wójcik', 'rejected'],
            ];

            foreach ($rows as $index => $row) {
                [$city, $firstName, $lastName, $status] = $row;

                $branch = Branch::firstOrCreate(
                    ['city' => $city],
                    ['name' => 'SEKA ' . $city]
                );

                Candidate::firstOrCreate(
                    [
                        'email' => 'demo.candidate.'
                            . ($index + 1) . '@example.com',
                        'source' => 'demo_seed',
                    ],
                    [
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                        'branch_id' => $branch->id,
                        'position' => 'Koordynator szkoleń',
                        'status' => $status,
                        'hr_notes' => 'Fikcyjny kandydat demonstracyjny.',
                    ]
                );
            }
        });

        $this->command->info(
            'Dodano brakujące dane demonstracyjne.'
        );
    }
}
