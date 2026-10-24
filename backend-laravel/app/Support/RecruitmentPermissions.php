<?php

namespace App\Support;

class RecruitmentPermissions
{
    public const BUSINESS = [
        'applications.view', 'applications.edit_status', 'applications.edit_notes',
        'applications.edit_position', 'applications.assign_branch', 'cv.view', 'cv.upload', 'intake.create',
    ];

    public static function catalog(): array
    {
        return [
            ['code' => 'applications.view', 'label_pl' => 'Przegląd aplikacji i historii', 'label_en' => 'View applications and history'],
            ['code' => 'applications.edit_status', 'label_pl' => 'Zmiana statusu', 'label_en' => 'Change status'],
            ['code' => 'applications.edit_notes', 'label_pl' => 'Edycja notatek HR', 'label_en' => 'Edit HR notes'],
            ['code' => 'applications.edit_position', 'label_pl' => 'Zmiana stanowiska', 'label_en' => 'Change position'],
            ['code' => 'applications.assign_branch', 'label_pl' => 'Przypisanie oddziału (cała firma)', 'label_en' => 'Assign branch (company-wide scope)'],
            ['code' => 'cv.view', 'label_pl' => 'Otwieranie CV', 'label_en' => 'Open CVs'],
            ['code' => 'cv.upload', 'label_pl' => 'Przesyłanie CV', 'label_en' => 'Upload CVs'],
            ['code' => 'intake.create', 'label_pl' => 'Przyjęcie aplikacji (cała firma)', 'label_en' => 'Create intake (company-wide scope)'],
        ];
    }
}
