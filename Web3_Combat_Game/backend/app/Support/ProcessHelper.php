<?php

namespace App\Support;

/**
 * Lance un process en arrière-plan de façon compatible Windows (start /B)
 * et Linux/Unix (nohup … &), y compris dans les conteneurs Docker.
 */
class ProcessHelper
{
    public static function spawnBackground(string $command): void
    {
        if (stripos(PHP_OS_FAMILY, 'WIN') === 0) {
            $cmd = 'start /B "" ' . $command;
        } else {
            $cmd = 'nohup ' . $command . ' &';
        }

        pclose(popen($cmd, 'r'));
    }
}
