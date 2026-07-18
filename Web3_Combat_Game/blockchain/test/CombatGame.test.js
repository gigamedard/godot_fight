import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("CombatGame - Battle Royale Pools", function () {
    let CombatGame;
    let game;
    let owner, p1, p2, p3;

    beforeEach(async function () {
        [owner, p1, p2, p3] = await ethers.getSigners();
        const CombatGameFactory = await ethers.getContractFactory("CombatGame");
        game = await CombatGameFactory.deploy();
        await game.waitForDeployment();
    });

    describe("Pool Creation and Joining", function () {
        it("should create a pool with valid parameters", async function () {
            const entryFee = ethers.parseEther("1.0");
            
            // Create a pool with PenaltyMode.OneBaseBet (0)
            await expect(game.createPool(entryFee, 8, 0))
                .to.emit(game, "PoolCreated")
                .withArgs(1, entryFee, 8, 0, owner.address);

            const pool = await game.pools(1);
            expect(pool.entryFee).to.equal(entryFee);
            expect(pool.maxPlayers).to.equal(8n);
            expect(pool.penaltyMode).to.equal(0);
            expect(pool.isActive).to.be.true;
        });

        it("should allow a player to join a pool by paying entry fee + tx fee", async function () {
            const entryFee = ethers.parseEther("10.0");
            await game.createPool(entryFee, 4, 1); // Mode: AllBalance
            
            const feePercent = await game.feePercent(); // usually 50 (5%)
            const txFee = (entryFee * feePercent) / 1000n;
            const totalRequired = entryFee + txFee;

            await expect(game.connect(p1).joinPool(1, { value: totalRequired }))
                .to.emit(game, "PoolJoined")
                .withArgs(1, p1.address);
                
            const balance = await game.poolBalances(1, p1.address);
            expect(balance).to.equal(entryFee);
        });

        it("should revert if pool does not exist or not enough ETH sent", async function () {
            const entryFee = ethers.parseEther("10.0");
            await game.createPool(entryFee, 4, 1);
            
            await expect(game.connect(p1).joinPool(99, { value: entryFee }))
                .to.be.revertedWith("Pool not active");

            await expect(game.connect(p1).joinPool(1, { value: entryFee }))
                .to.be.revertedWith("Incorrect value sent (must include fee)"); // Needs the 5% fee
        });
    });

    describe("Pool Matchmaking (Challenge & Accept)", function () {
        let entryFee;
        let totalRequired;

        beforeEach(async function () {
            entryFee = ethers.parseEther("10.0");
            await game.createPool(entryFee, 4, 0); // OneBaseBet
            const feePercent = await game.feePercent();
            totalRequired = entryFee + (entryFee * feePercent) / 1000n;
            
            await game.connect(p1).joinPool(1, { value: totalRequired });
            await game.connect(p2).joinPool(1, { value: totalRequired });
        });

        it("should allow a player in the pool to challenge another player in the pool", async function () {
            // p1 challenges p2
            await expect(game.connect(p1).challengePool(p2.address, 1, 1))
                .to.emit(game, "ChallengeCreated")
                .withArgs(1, p1.address, p2.address, entryFee, 1);
            
            const match = await game.matches(1);
            expect(match.challenger).to.equal(p1.address);
            expect(match.target).to.equal(p2.address);
            expect(match.betAmount).to.equal(entryFee); // Set to pool's entry fee
            expect(match.poolId).to.equal(1n);
        });

        it("should revert if non-pool member challenges", async function () {
            await expect(game.connect(p3).challengePool(p1.address, 1, 1))
                .to.be.revertedWith("Insufficient pool balance");
        });

        it("should revert if challenging non-pool member", async function () {
            await expect(game.connect(p1).challengePool(p3.address, 1, 1))
                .to.be.revertedWith("Target not in pool");
        });

        it("should allow target to accept a pool challenge", async function () {
            await game.connect(p1).challengePool(p2.address, 1, 1);
            
            await expect(game.connect(p2).acceptPoolChallenge(1, 2))
                .to.emit(game, "ChallengeAccepted")
                .withArgs(1, 2);
                
            const match = await game.matches(1);
            expect(match.state).to.equal(1); // Accepted
        });
    });

    describe("Pool Penalty Rules", function () {
        let entryFee;
        
        async function setupMatch(poolId, penaltyMode) {
            entryFee = ethers.parseEther("10.0");
            await game.createPool(entryFee, 4, penaltyMode);
            const feePercent = await game.feePercent();
            const totalRequired = entryFee + (entryFee * feePercent) / 1000n;
            
            await game.connect(p1).joinPool(poolId, { value: totalRequired });
            await game.connect(p2).joinPool(poolId, { value: totalRequired });
            
            await game.connect(p1).challengePool(p2.address, 1, poolId);
            await game.connect(p2).acceptPoolChallenge(1, 2);
        }

        it("OneBaseBet: Loser loses 1 entryFee, Winner gains 1 entryFee", async function () {
            await setupMatch(1, 0); // OneBaseBet
            
            // p1 plays 1, p2 plays 3 => p1 wins (Rock vs Scissors)
            const secret = "0x1234567890123456789012345678901234567890123456789012345678901234";
            const hash1 = ethers.solidityPackedKeccak256(["uint8", "string"], [1, secret]);
            const hash2 = ethers.solidityPackedKeccak256(["uint8", "string"], [3, secret]);
            
            await game.connect(p1).commitMove(1, hash1);
            await game.connect(p2).commitMove(1, hash2);
            
            await game.connect(p1).revealMove(1, 1, secret);
            await expect(game.connect(p2).revealMove(1, 3, secret))
                .to.emit(game, "MatchFinished")
                .withArgs(1, p1.address, ethers.parseEther("20.0"));
                
            const bal1 = await game.poolBalances(1, p1.address);
            const bal2 = await game.poolBalances(1, p2.address);
            
            expect(bal1).to.equal(ethers.parseEther("20.0")); // 10 + 10
            expect(bal2).to.equal(0n); // 10 - 10
        });
    });
});
