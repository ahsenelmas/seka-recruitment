<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Smalot\PdfParser\Parser;
use Throwable;

class EmailIntakeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => [
                'required',
                'email',
                'max:254',
                'regex:/^[^@\s]+@example\.com$/i',
            ],
            'position' => ['nullable', 'string', 'max:150'],
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id'),
            ],
            'email_subject' => ['required', 'string', 'max:255'],
            'email_body' => ['required', 'string', 'max:10000'],
            'file' => ['nullable', 'file', 'max:5120'],
        ], [
            'required' => 'Pole :attribute jest wymagane.',
            'string' => 'Pole :attribute musi zawierać tekst.',
            'max' => 'Przekroczono limit pola :attribute.',
            'email' => 'Podaj prawidłowy adres e-mail.',
            'regex' => 'Użyj fikcyjnego adresu w domenie example.com.',
            'integer' => 'Wybierz prawidłowy oddział.',
            'exists' => 'Nie znaleziono oddziału.',
            'file' => 'Nie udało się odczytać załącznika.',
            'file.max' => 'Maksymalny rozmiar załącznika to 5 MB.',
        ], [
            'first_name' => 'imię',
            'last_name' => 'nazwisko',
            'email' => 'e-mail',
            'position' => 'stanowisko',
            'branch_id' => 'oddział',
            'email_subject' => 'temat wiadomości',
            'email_body' => 'treść wiadomości',
            'file' => 'załącznik',
        ]);

        $file = $request->file('file');
        $key = null;
        $originalName = null;
        $problem = null;

        if ($file !== null) {
            $originalName = mb_substr(
                basename(str_replace(
                    '\\',
                    '/',
                    $file->getClientOriginalName()
                )),
                0,
                255
            );

            try {
                if (
                    strtolower($file->getClientOriginalExtension())
                    !== 'pdf'
                ) {
                    throw new \RuntimeException('Not a PDF.');
                }

                $document = (new Parser())->parseFile(
                    $file->getRealPath()
                );

                if (count($document->getPages()) === 0) {
                    throw new \RuntimeException('No pages.');
                }
            } catch (Throwable $error) {
                $problem = 'Nie można odczytać załącznika. '
                    . 'Prześlij poprawny dokument CV w formacie PDF bez hasła.';
            }
        }

        $disk = Storage::disk('local');

        try {
            if ($file !== null && $problem === null) {
                $key = 'cvs/' . Str::uuid() . '.pdf';

                $stored = $disk->putFileAs(
                    'cvs',
                    $file,
                    basename($key)
                );

                if ($stored === false) {
                    throw new \RuntimeException(
                        'Nie udało się zapisać dokumentu CV.'
                    );
                }
            }

            $candidate = DB::transaction(function () use (
                $data,
                $key,
                $originalName,
                $problem
            ) {
                return Candidate::create([
                    'first_name' => trim($data['first_name']),
                    'last_name' => trim($data['last_name']),
                    'email' => strtolower(trim($data['email'])),
                    'position' => trim(
                        (string) ($data['position'] ?? '')
                    ) ?: null,
                    'branch_id' => $data['branch_id'] ?? null,
                    'status' => 'new',
                    'source' => 'sample_email',
                    'email_subject' => $data['email_subject'],
                    'email_body' => $data['email_body'],
                    'hr_notes' => 'Aplikacja demonstracyjna z wiadomości e-mail.',
                    'cv_storage_key' => $key,
                    'cv_original_filename' => $key
                        ? $originalName
                        : null,
                    'cv_validation_error' => $problem,
                ]);
            });
        } catch (Throwable $error) {
            if ($key !== null) {
                $disk->delete($key);
            }

            throw $error;
        }

        return response()->json(
            $candidate->fresh('branch'),
            201
        );
    }
}