<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La poule ne devient visible/joignable qu'après le dépôt du créateur.
 * Pour distinguer le créateur des autres joueurs pendant la phase
 * `pending_creation`, on mémorise son wallet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pools', function (Blueprint $table) {
            $table->string('owner_wallet', 42)->nullable()->after('is_private');
        });
    }

    public function down(): void
    {
        Schema::table('pools', function (Blueprint $table) {
            $table->dropColumn('owner_wallet');
        });
    }
};
