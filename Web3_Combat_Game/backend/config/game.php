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

    /*
    |--------------------------------------------------------------------------
    | Délai d'annulation d'une poule bloquée (dépôts incomplets)
    |--------------------------------------------------------------------------
    | Une poule en statut "open" ou "pending_creation" qui n'a pas atteint
    | "pleine + tous dépôts confirmés" au bout de ce délai (en minutes, compté
    | depuis sa création) est annulée : les joueurs ayant déposé peuvent alors
    | réclamer leur mise (remboursement via claimPoolShare).
    | Configurable via POOL_DEPOSIT_TIMEOUT_MINUTES.
    */
    'pool_deposit_timeout_minutes' => (int) env('POOL_DEPOSIT_TIMEOUT_MINUTES', 10),

];
