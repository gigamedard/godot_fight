<?php

namespace App\Support;

/**
 * Conversions décimales ↔ entiers (wei) sans dépendre de bcmath.
 * Le butin des poules est stocké en wei (entier, string) pour des
 * comparaisons/transferts exacts via gmp.
 */
class Wei
{
    public static function toWei($human, int $decimals = 18): string
    {
        $s = (string) $human;

        // Notation scientifique éventuelle (ex: 1e-3) → décimal fixe.
        if (stripos($s, 'e') !== false) {
            $s = number_format((float) $s, $decimals, '.', '');
        }

        $neg = false;
        if (str_starts_with($s, '-')) {
            $neg = true;
            $s = substr($s, 1);
        }

        $parts = explode('.', $s, 2);
        $int = ($parts[0] === '') ? '0' : $parts[0];
        $frac = str_pad(substr($parts[1] ?? '', 0, $decimals), $decimals, '0');

        $wei = $int . $frac;
        $wei = ltrim($wei, '0');
        if ($wei === '') {
            $wei = '0';
        }

        return $neg ? '-' . $wei : $wei;
    }

    public static function fromWei($wei, int $decimals = 18): string
    {
        $s = (string) $wei;

        $neg = false;
        if (str_starts_with($s, '-')) {
            $neg = true;
            $s = substr($s, 1);
        }

        $s = str_pad($s, $decimals + 1, '0', STR_PAD_LEFT);
        $int = substr($s, 0, -$decimals);
        $frac = rtrim(substr($s, -$decimals), '0');

        $out = ($frac !== '') ? $int . '.' . $frac : $int;

        return $neg ? '-' . $out : $out;
    }
}
