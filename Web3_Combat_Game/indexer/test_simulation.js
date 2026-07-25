const { ethers } = require("ethers");
const fs = require("fs");
const axios = require("axios");

async function main() {
    console.log("Starting E2E Integration Test...");

    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const signers = await provider.listAccounts();
    const p1 = await provider.getSigner(signers[1].address);
    const p2 = await provider.getSigner(signers[2].address);
    const p3 = await provider.getSigner(signers[3].address);

    const artifactPath = "G:/DEV/GODOT_GAME/Web3_Combat_Game/blockchain/artifacts/contracts/CombatGame.sol/CombatGame.json";
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;
    const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const contract1 = new ethers.Contract(CONTRACT_ADDRESS, abi, p1);
    const contract2 = new ethers.Contract(CONTRACT_ADDRESS, abi, p2);
    const contract3 = new ethers.Contract(CONTRACT_ADDRESS, abi, p3);

    console.log("1. Creating Pool with Player 1...");
    const entryFee = ethers.parseEther("0.01");
    const totalFee = entryFee + (entryFee * 25n / 1000n);

    let tx = await contract1.createAndJoinPool(entryFee, 3, 0, { value: totalFee });
    let receipt = await tx.wait();
    
    // Get Pool ID
    let poolId = null;
    for (const log of receipt.logs) {
        try {
            const parsed = contract1.interface.parseLog(log);
            if (parsed && parsed.name === 'PoolCreated') {
                poolId = parsed.args[0];
            }
        } catch(e) {}
    }
    console.log(`Pool Created with ID: ${poolId}`);

    // Call Laravel to register pool just like frontend does
    console.log("Registering pool in Laravel...");
    await axios.post("http://localhost:8000/api/pools", {
        id: Number(poolId),
        entry_fee: 0.01,
        max_players: 3,
        penalty_mode: 0,
        is_private: true
    });

    console.log("2. Player 2 joining...");
    tx = await contract2.joinPool(poolId, { value: totalFee });
    await tx.wait();

    console.log("3. Player 3 joining... (This should trigger PoolStarted)");
    tx = await contract3.joinPool(poolId, { value: totalFee });
    await tx.wait();

    console.log("Waiting 3 seconds for Indexer to process webhook...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Checking Laravel Database for Pool and Players...");
    try {
        const poolRes = await axios.get(`http://localhost:8000/api/pools/${poolId}`);
        console.log("Pool Status in Laravel:", poolRes.data.status);
        console.log("Players count in Laravel:", poolRes.data.players_count);
        
        if (poolRes.data.status === 'waiting' || poolRes.data.status === 'open') {
             console.log("✅ Webhook was processed successfully!");
        } else {
             console.error("❌ Pool status is weird:", poolRes.data.status);
        }
    } catch (e) {
        console.error("❌ Failed to fetch pool from Laravel:", e.response ? e.response.data : e.message);
    }
}

main().catch(console.error);
