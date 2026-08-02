import fs from "fs";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const art = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
const ro = new ethers.Contract(addr, art.abi, provider);
const owner = await ro.owner();

const PLAYERS = [
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
];

// base (block current)
const block = await provider.getBlockNumber();
const ts = new Date().toISOString();

console.log("=== SNAPSHOT " + ts + " (block " + block + ") ===");
console.log("contrat = " + addr);
console.log("owner = " + owner);
console.log("treasuryBalances(owner) = " + ethers.formatEther(await ro.treasuryBalances(owner)));

for (let i = 0; i < PLAYERS.length; i++) {
  const a = ethers.getAddress(PLAYERS[i].toLowerCase());
  const eth = await provider.getBalance(a);
  const ub = await ro.userBalances(a);
  console.log(`\n[P${i}] ${a}`);
  console.log(`   ETH wallet   (native) = ${ethers.formatEther(eth)}`);
  console.log(`   userBalances (duels)  = ${ethers.formatEther(ub)}`);
}

console.log("\n=== Escrow poules (peupler jusqu'a block) ===");
for (let pool = 1; pool <= 40; pool++) {
  const total = await ro.poolTotal(pool);
  const settled = await ro.poolSettled(pool);
  if (total > 0n || settled) {
    console.log(`  Pool #${pool}: total=${ethers.formatEther(total)} settled=${settled}`);
  }
}

// compare expect about pool40 (future test)
const totalBal = await provider.getBalance(PLAYERS[0]);
console.log("\nNOTE: block courant=" + block + " — re-lancer apres test pour delta.");