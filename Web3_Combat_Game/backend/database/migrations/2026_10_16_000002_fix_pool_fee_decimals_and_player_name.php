<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Correctifs économie de poule :
 *  - `pools.entry_fee` et `fights.base_bet_amount` étaient `decimal(20,0)` :
 *    toute mise < 1 TST (ex. 0.4) était TRONQUÉE à 0 → butin 0 partout.
 *    On passe en décimales (TST, 8 chiffres après la virgule).
 *  - `pool_players.player_name` : pseudonyme affiché dans la liste de la poule.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pools', function (Blueprint $table) {
            $table->decimal('entry_fee', 30, 8)->change();
        });

        Schema::table('fights', function (Blueprint $table) {
            $table->decimal('base_bet_amount', 30, 8)->default(0)->change();
        });

        Schema::table('pool_players', function (Blueprint $table) {
            $table->string('player_name', 24)->nullable()->after('character_id');
        });
    }

    public function down(): void
    {
        Schema::table('pool_players', function (Blueprint $table) {
            $table->dropColumn('player_name');
        });

        Schema::table('fights', function (Blueprint $table) {
            $table->decimal('base_bet_amount', 20, 0)->default(0)->change();
        });

        Schema::table('pools', function (Blueprint $table) {
            $table->decimal('entry_fee', 20, 0)->change();
        });
    }
};
