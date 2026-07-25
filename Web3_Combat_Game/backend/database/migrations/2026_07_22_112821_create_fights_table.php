<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pool_id')->nullable()->constrained('pools')->onDelete('cascade');
            $table->string('player1_wallet');
            $table->string('player2_wallet');
            $table->string('player1_commit')->nullable();
            $table->string('player2_commit')->nullable();
            $table->integer('player1_move')->nullable();
            $table->integer('player2_move')->nullable();
            $table->enum('status', ['waiting_for_commits', 'waiting_for_reveals', 'completed', 'canceled'])->default('waiting_for_commits');
            $table->enum('result', ['player1_win', 'player2_win', 'draw', 'timeout', 'double_elimination', 'pending'])->default('pending');
            $table->decimal('base_bet_amount', 20, 0)->default(0); // Using 20,0 to support wei values if needed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fights');
    }
};
