<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pool_players', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('pool_id');
            $table->string('wallet_address', 42);
            $table->integer('character_id')->default(2);
            $table->string('status')->default('alive'); // alive, eliminated, waiting
            $table->timestamps();
            
            $table->foreign('pool_id')->references('id')->on('pools')->onDelete('cascade');
            $table->unique(['pool_id', 'wallet_address']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pool_players');
    }
};
