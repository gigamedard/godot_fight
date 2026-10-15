<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chantier 3 (nouvelle version) : économie de poule « butin » + types de tournoi.
 *  - pools : condition de fin (last_man | remaining | time) + paramètres + bornes.
 *  - pool_players : butin virtuel (`loot`, en wei) + nombre de défaites (`losses`).
 *
 * MVP : le butin est un SCORE d'affichage (le règlement on-chain reste inchangé :
 * un seul champion réclame le pot). La distribution réelle viendra plus tard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pools', function (Blueprint $table) {
            $table->string('end_condition', 16)->default('last_man'); // last_man | remaining | time
            $table->integer('end_count')->nullable();    // « remaining » : Nb de survivants cible
            $table->integer('end_seconds')->nullable();  // « time » : durée (s)
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
        });

        Schema::table('pool_players', function (Blueprint $table) {
            $table->string('loot', 78)->default('0'); // butin virtuel (wei, string)
            $table->integer('losses')->default(0);   // défaites (règle : 1re = tout, ensuite plancher)
        });
    }

    public function down(): void
    {
        Schema::table('pools', function (Blueprint $table) {
            $table->dropColumn(['end_condition', 'end_count', 'end_seconds', 'started_at', 'finished_at']);
        });

        Schema::table('pool_players', function (Blueprint $table) {
            $table->dropColumn(['loot', 'losses']);
        });
    }
};
