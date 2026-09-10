<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sécurisation de l'escrow : le combat ne démarre que quand les DEUX dépôts
 * sont confirmés on-chain. Le front notifie POST /battle/deposited avec son
 * tx hash ; le backend vérifie le receipt et flag p1_deposited / p2_deposited.
 * MatchStarted n'est broadcasté qu'après confirmation des deux.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fights', function (Blueprint $table) {
            $table->boolean('p1_deposited')->default(false);
            $table->boolean('p2_deposited')->default(false);
            $table->string('p1_deposit_tx', 66)->nullable();
            $table->string('p2_deposit_tx', 66)->nullable();
            $table->timestamp('p1_deposited_at')->nullable();
            $table->timestamp('p2_deposited_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('fights', function (Blueprint $table) {
            $table->dropColumn(['p1_deposited', 'p2_deposited', 'p1_deposit_tx', 'p2_deposit_tx', 'p1_deposited_at', 'p2_deposited_at']);
        });
    }
};