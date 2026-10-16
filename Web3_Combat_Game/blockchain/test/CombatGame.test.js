import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

// Suite conforme à CombatGame EN LIGNE (0xA2722921B753C1E76e1d9a4294204DF983746C3D).
// Remplace l'ancienne suite obsolète (createPool/joinPool/challengePool) qui
// testait une API supprimée et échouait déjà avant.
describe("CombatGame (Pingala) — register, escrow de poule, règlements", function () {
    let game;
    let owner, backendSigner, p1, p2;
    const ONE = ethers.parseEther("1");
    const FEE_BPS = 250n; // 2,5 %

    beforeEach(async function () {
        [owner, backendSigner, p1, p2] = await ethers.getSigners();
        const F = await ethers.getContractFactory("CombatGame");
        game = await F.deploy(backendSigner.address);
        await game.waitForDeployment();
    });

    it("déploie owner = déployeur, backendSigner correct, feeBps = 250", async function () {
        expect(await game.owner()).to.equal(owner.address);
        expect(await game.backendSigner()).to.equal(backendSigner.address);
        expect(await game.feeBps()).to.equal(250n);
    });

    describe("register (duel, payable)", function () {
        it("crédite userBalances et la trésorerie", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).register(stake, { value: stake + fee });
            expect(await game.userBalances(p1.address)).to.equal(stake);
            expect(await game.treasuryBalances(owner.address)).to.equal(fee);
        });

        it("revert si le montant n'est pas exactement stake + fee", async function () {
            await expect(game.connect(p1).register(ONE, { value: ONE }))
                .to.be.revertedWith("Send exact stake + fee");
        });
    });

    describe("registerForPool (escrow de poule)", function () {
        it("verrouille le stake dans l'escrow + prélève la fee", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).registerForPool(1, stake, { value: stake + fee });
            expect(await game.poolEscrow(1, p1.address)).to.equal(stake);
            expect(await game.poolTotal(1)).to.equal(stake);
            expect(await game.treasuryBalances(owner.address)).to.equal(fee);
        });
    });

    describe("settleLoser (voucher backend, gain du duel)", function () {
        it("déplace la balance du perdant vers le gagnant", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).register(stake, { value: stake + fee });
            await game.connect(p2).register(stake, { value: stake + fee });

            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "address", "address"],
                [p1.address, p2.address, await game.getAddress()]
            );
            const sig = await backendSigner.signMessage(ethers.getBytes(messageHash));

            await expect(game.connect(p1).settleLoser(p1.address, p2.address, sig))
                .to.emit(game, "MatchSettled").withArgs(p1.address, p2.address, stake);
            expect(await game.userBalances(p1.address)).to.equal(stake * 2n);
            expect(await game.userBalances(p2.address)).to.equal(0n);
        });
    });

    describe("claimPoolShare (répartition par joueur, voucher backend)", function () {
        const mkShare = (contractAddr, poolId, user, amount, nonce) =>
            ethers.solidityPackedKeccak256(
                ["string", "uint256", "address", "uint256", "uint256", "address"],
                ["POOL_SHARE", poolId, user, amount, nonce, contractAddr]
            );

        it("chaque joueur réclame sa part ; pool settled quand épuisé", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).registerForPool(1, stake, { value: stake + fee });
            await game.connect(p2).registerForPool(1, stake, { value: stake + fee });

            const addr = await game.getAddress();
            const pot = await game.poolTotal(1); // 2 * stake
            const sig1 = await backendSigner.signMessage(ethers.getBytes(mkShare(addr, 1, p1.address, stake, 11)));
            const sig2 = await backendSigner.signMessage(ethers.getBytes(mkShare(addr, 1, p2.address, stake, 12)));

            await expect(game.connect(p1).claimPoolShare(1, stake, 11, sig1))
                .to.emit(game, "PoolShareClaimed").withArgs(1, p1.address, stake);
            expect(await game.poolSettled(1)).to.equal(false);

            await expect(game.connect(p2).claimPoolShare(1, stake, 12, sig2))
                .to.emit(game, "PoolShareClaimed").withArgs(1, p2.address, stake);
            expect(await game.poolClaimedTotal(1)).to.equal(pot);
            expect(await game.poolSettled(1)).to.equal(true);
        });

        it("revert si la signature n'est pas du backend signer", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).registerForPool(1, stake, { value: stake + fee });
            const addr = await game.getAddress();
            const bad = mkShare(addr, 1, p1.address, stake, 99);
            const sig = await p2.signMessage(ethers.getBytes(bad));
            await expect(game.connect(p1).claimPoolShare(1, stake, 99, sig))
                .to.be.revertedWith("Invalid backend signature");
        });
    });

    describe("setFeeBps (owner)", function () {
        it("revert si non-owner", async function () {
            await expect(game.connect(p1).setFeeBps(500)).to.be.revertedWith("Not owner");
        });
    });
});
