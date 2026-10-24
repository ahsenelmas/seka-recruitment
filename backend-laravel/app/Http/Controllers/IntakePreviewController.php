<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Support\IntakeSuggestions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;
use Throwable;

class IntakePreviewController extends Controller
{
    public function __invoke(Request $request, IntakeSuggestions $extractor): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:254', 'regex:/^[^@\s]+@example\.com$/i'],
            'email_subject' => ['required', 'string', 'max:255'],
            'email_body' => ['required', 'string', 'max:10000'],
            'file' => ['nullable', 'file', 'max:5120'],
        ]);
        $sources = ['email' => $data['email_subject']."\n".$data['email_body']];
        $issues = []; $cvStatus = 'missing';
        if ($file = $request->file('file')) {
            try {
                if (strtolower($file->getClientOriginalExtension()) !== 'pdf') throw new \RuntimeException('PDF required');
                $config = new Config();
                $config->setDecodeMemoryLimit(20 * 1024 * 1024);
                $document = (new Parser([], $config))->parseFile($file->getRealPath());
                $pages = $document->getPages();
                if (count($pages) === 0) throw new \RuntimeException('No pages');
                $text = '';
                foreach (array_slice($pages, 0, 5) as $page) {
                    $text .= $page->getText()."\n";
                    if (mb_strlen($text) >= 20000) break;
                }
                $sources['cv'] = mb_substr($text, 0, 20000);
                $cvStatus = trim($sources['cv']) === '' ? 'no_text' : 'readable';
                if ($cvStatus === 'no_text') $issues[] = 'cv_no_text';
                if (count($pages) > 5 || mb_strlen($text) > 20000) $issues[] = 'cv_preview_limited';
            } catch (Throwable $error) {
                $cvStatus = 'unreadable';
                $issues[] = 'unreadable_cv';
            }
        } else $issues[] = 'missing_cv';
        $result = $extractor->extract($sources, Branch::withoutGlobalScopes()->orderBy('id')->get(['id', 'city']));
        return response()->json([
            ...$result,
            'issues' => array_values(array_unique([...$result['issues'], ...$issues])),
            'cv_status' => $cvStatus, 'method' => 'local_rules', 'needs_review' => true,
        ]);
    }
}
