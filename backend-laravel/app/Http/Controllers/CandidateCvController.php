<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class CandidateCvController extends Controller
{
    public function upload(Request $request, string $id): JsonResponse
    {
        abort_unless(Candidate::whereKey($id)->exists(), 404);

        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:pdf',
                'extensions:pdf',
                'max:5120',
            ],
        ]);

        $file = $request->file('file');

        try {
            $document = (new Parser())->parseFile(
                $file->getRealPath()
            );

            if (count($document->getPages()) === 0) {
                throw new \RuntimeException('No pages.');
            }
        } catch (Throwable $error) {
            throw ValidationException::withMessages([
                'file' => [
                    'Nie można odczytać PDF. Prześlij poprawny dokument bez hasła.',
                ],
            ]);
        }

        $disk = Storage::disk('local');
        $key = 'cvs/' . Str::uuid() . '.pdf';

        $stored = $disk->putFileAs(
            'cvs',
            $file,
            basename($key)
        );

        abort_if($stored === false, 500, 'Nie udało się zapisać CV.');

        $originalName = basename(str_replace(
            '\\',
            '/',
            $file->getClientOriginalName()
        ));

        try {
            $oldKey = DB::transaction(function () use (
                $id,
                $key,
                $originalName
            ) {
                $candidate = Candidate::whereKey($id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $previous = $candidate->cv_storage_key;

                $candidate->cv_storage_key = $key;
                $candidate->cv_original_filename = mb_substr(
                    $originalName,
                    0,
                    255
                );
                $candidate->cv_validation_error = null;
                $candidate->save();

                return $previous;
            });
        } catch (Throwable $error) {
            $disk->delete($key);
            throw $error;
        }

        if ($oldKey && $this->validKey($oldKey)) {
            try {
                $disk->delete($oldKey);
            } catch (Throwable $error) {
                report($error);
            }
        }

        return response()->json(
            Candidate::with('branch')->findOrFail($id)
        );
    }

    public function show(string $id): BinaryFileResponse
    {
        $candidate = Candidate::findOrFail($id);
        $key = $candidate->cv_storage_key;

        abort_unless(
            $key && $this->validKey($key),
            404,
            'Nie dodano dokumentu CV.'
        );

        $disk = Storage::disk('local');

        abort_unless(
            $disk->exists($key),
            404,
            'Nie znaleziono dokumentu CV.'
        );

        return response()->file($disk->path($key), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="cv.pdf"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function validKey(string $key): bool
    {
        return preg_match(
            '/\Acvs\/[0-9a-f-]{36}\.pdf\z/',
            $key
        ) === 1;
    }
}
