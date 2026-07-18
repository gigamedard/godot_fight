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
        Schema::create('pools', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary(); // Matches on-chain poolId
            $table->decimal('entry_fee', 20, 0); // In Wei
            $table->integer('max_players');
            $table->integer('penalty_mode'); // 0 = OneBaseBet, 1 = AllBalance
            $table->boolean('is_private')->default(false);
            $table->string('invite_code')->nullable()->unique();
            $table->string('status')->default('open'); // open, active, finished
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pools');
    }
};
