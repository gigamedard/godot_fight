<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Anti-course : on ne démarre la poule qu'une fois que TOUS les joueurs ont
 * confirmé leur dépôt on-chain (comme pour les duels : p1/p2_deposited).
 * La dernière personne à rejoindre doit avoir le temps de valider dans son
 * wallet avant que le combat ne commence.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pool_players', function (Blueprint $table) {
            $table->boolean('deposited')->default(false)->after('status');
            $table->string('deposit_tx', 66)->nullable()->after('deposited');
            $table->timestamp('deposited_at')->nullable()->after('deposit_tx');
        });
    }

    public function down(): void
    {
        Schema::table('pool_players', function (Blueprint $table) {
            $table->dropColumn(['deposited', 'deposit_tx', 'deposited_at']);
        });
    }
};
