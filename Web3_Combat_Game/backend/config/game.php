<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Règles de jeu
    |--------------------------------------------------------------------------
    |
    | Durée d'un round de combat avant résolution par forfait côté serveur.
    | Configurable par le développeur via la variable d'environnement
    | FIGHT_TIMEOUT_MS (millisecondes). La deadline de chaque combat est
    | ancrée sur sa création (created_at) : le compte à rebours exposé aux
    | joueurs est donc monotone (il ne remonte jamais).
    |
    */

    'fight_timeout_ms' => (int) env('FIGHT_TIMEOUT_MS', 60000),

];
