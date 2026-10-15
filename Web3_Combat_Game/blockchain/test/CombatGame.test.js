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

    describe("claimPool (voucher backend)", function () {
        it("le champion récupère le pot avec une signature valide", async function () {
            const stake = ONE;
            const fee = (stake * FEE_BPS) / 10000n;
            await game.connect(p1).registerForPool(1, stake, { value: stake + fee });
            await game.connect(p2).registerForPool(1, stake, { value: stake + fee });

            const pot = await game.poolTotal(1); // 2 * stake
            const messageHash = ethers.solidityPackedKeccak256(
                ["uint256", "address", "uint256", "uint256", "address"],
                [1, p1.address, pot, 1, await game.getAddress()]
            );
            const sig = await backendSigner.signMessage(ethers.getBytes(messageHash));

            await expect(game.connect(p1).claimPool(1, pot, 1, sig)).to.emit(game, "PoolClaimed");
            expect(await game.poolTotal(1)).to.equal(0n);
        });
    });

    describe("setFeeBps (owner)", function () {
        it("revert si non-owner", async function () {
            await expect(game.connect(p1).setFeeBps(500)).to.be.revertedWith("Not owner");
        });
    });
});
