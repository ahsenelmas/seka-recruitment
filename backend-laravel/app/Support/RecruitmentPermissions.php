<?php

namespace App\Support;

class RecruitmentPermissions
{
    public const BUSINESS = [
        'applications.view', 'applications.edit_status', 'applications.edit_notes',
        'applications.edit_position', 'applications.assign_branch', 'cv.view', 'cv.upload', 'intake.create', 'correspondence.view', 'correspondence.draft', 'tasks.view', 'tasks.manage', 'tasks.complete', 'work.assign',
    ];

    public static function catalog(): array
    {
        return [
            ['code' => 'tasks.view', 'label_pl' => 'Przegląd zadań i opiekuna', 'label_en' => 'View tasks and ownership'],
            ['code' => 'tasks.manage', 'label_pl' => 'Tworzenie i delegowanie zadań', 'label_en' => 'Create and delegate tasks'],
            ['code' => 'tasks.complete', 'label_pl' => 'Realizacja własnych zadań', 'label_en' => 'Complete own tasks'],
            ['code' => 'work.assign', 'label_pl' => 'Przypisanie opiekuna i terminu kontaktu', 'label_en' => 'Assign owner and follow-up date'],
            ['code' => 'correspondence.view', 'label_pl' => 'Przegląd korespondencji', 'label_en' => 'View correspondence'],
            ['code' => 'correspondence.draft', 'label_pl' => 'Tworzenie i edycja szkiców odpowiedzi', 'label_en' => 'Create and edit reply drafts'],
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
