<?php

namespace App\Support;

use RuntimeException;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Document;
use Smalot\PdfParser\Parser;

class PdfInspector
{
    public static function document(string $path): Document
    {
        $config = new Config;
        $config->setDecodeMemoryLimit(20 * 1024 * 1024);
        $doc = (new Parser([], $config))->parseFile($path);
        $count = count($doc->getPages());
        if ($count === 0 || $count > 100) {
            throw new RuntimeException('PDF must contain 1–100 pages.');
        }

        return $doc;
    }
}
