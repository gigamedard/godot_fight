import hre from "hardhat";

async function main() {
    const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const game = await hre.ethers.getContractAt("CombatGame", CONTRACT_ADDRESS);
    const poolId = 23;
    const pool = await game.pools(poolId);
    console.log(`Pool ${poolId}:`, pool);
}

main().catch(console.error);
