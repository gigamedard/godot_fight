const {ethers} = require('hardhat');

async function main() {
    const [w1, w2, w3] = await ethers.getSigners();
    const c = await ethers.getContractAt("CombatGame", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

    c.on("PoolStarted", (poolId, participants, event) => {
        console.log("EVENT FIRED! PoolStarted:", poolId.toString(), participants);
        process.exit(0);
    });

    console.log("Listening...");

    const fee = ethers.parseEther("0.1");
    const totalFee = fee + (fee * 25n / 1000n);

    console.log("Creating...");
    await (await c.connect(w1).createAndJoinPool(fee, 3, 0, {value: totalFee})).wait();

    console.log("Joining w2...");
    await (await c.connect(w2).joinPool(2, {value: totalFee})).wait();

    console.log("Joining w3...");
    await (await c.connect(w3).joinPool(2, {value: totalFee})).wait();

    console.log("Waiting for event...");
    await new Promise(r => setTimeout(r, 5000));
    console.log("Event not received.");
}
main();
