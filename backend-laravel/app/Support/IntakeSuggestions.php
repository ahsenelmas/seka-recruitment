<?php

namespace App\Support;

use Illuminate\Support\Str;

/** Conservative, local rules: suggestions are never saved automatically. */
class IntakeSuggestions
{
    public function extract(array $sources, iterable $branches): array
    {
        $matches = ['first_name' => [], 'last_name' => [], 'position' => [], 'branch_id' => []];
        $patterns = [
            'first_name' => '/^\h*(?:imię|imie|first name)\h*:\h*([^\r\n:]{1,100})$/imu',
            'last_name' => '/^\h*(?:nazwisko|last name|surname)\h*:\h*([^\r\n:]{1,100})$/imu',
            'position' => '/^\h*(?:stanowisko|position|role)\h*:\h*([^\r\n:]{1,150})$/imu',
        ];
        foreach ($sources as $source => $text) {
            $text = str_replace(["\r\n", "\r"], "\n", $text);
            // PDF text may put several labelled fields on one line.
            $text = preg_replace(
                '/\h+(?=(?:imię|imie|first name|nazwisko|last name|surname|stanowisko|position|role|miasto|city)\h*:)/iu',
                "\n",
                $text
            );

            foreach ($patterns as $field => $pattern) {
                preg_match_all($pattern, $text, $rows, PREG_SET_ORDER);
                foreach ($rows as $row) {
                    $value = trim($row[1]);
                    if ($value !== '') $matches[$field][] = ['value' => $value, 'source' => $source, 'evidence' => mb_substr(trim($row[0]), 0, 200)];
                }
            }
            foreach (preg_split('/\R/u', $text) ?: [] as $line) {
                $normalized = mb_strtolower(Str::ascii($line));
                foreach ($branches as $branch) {
                    $city = mb_strtolower(Str::ascii($branch->city));
                    if (preg_match('/(?<![a-z0-9])'.preg_quote($city, '/').'(?![a-z0-9])/i', $normalized)) {
                        $matches['branch_id'][] = ['value' => (string) $branch->id, 'label' => $branch->city, 'source' => $source, 'evidence' => mb_substr(trim($line), 0, 200)];
                    }
                }
            }
        }
        $suggestions = []; $issues = [];
        foreach ($matches as $field => $items) {
            $unique = [];
            foreach ($items as $item) $unique[mb_strtolower(Str::ascii($item['value']))] = $item;
            $suggestions[$field] = count($unique) === 1 ? array_values($unique)[0] : null;
            if (count($unique) > 1) $issues[] = 'ambiguous_'.$field;
            elseif (count($unique) === 0) $issues[] = 'missing_'.$field;
        }
        return ['suggestions' => $suggestions, 'issues' => $issues];
    }
}
