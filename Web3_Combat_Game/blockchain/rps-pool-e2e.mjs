import fs from "fs";
import { ethers } from "ethers";

const RPC = "http://127.0.0.1:8545";
const BACKEND = "http://127.0.0.1:8000/api";
const provider = new ethers.JsonRpcProvider(RPC);
const art = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const _keys = JSON.parse(
  fs.readFileSync("../frontend/hardhat_keys.js", "utf8")
    .replace(/^const\s+?HARDHAT_ACCOUNTS\s*=\s*/, "")
    .replace(/;?\s*$/, "")
).map(k => ({ addr: k.address, pk: k.privateKey }));

const fmt = (b) => ethers.formatEther(b);

async function main() {
  const ro = new ethers.Contract(addr, art.abi, provider);
  const owner = await ro.owner();
  const POOL_ID = 1; // poule d'entrée

  // 3 joueurs NEUFS : les_9, _keys[8], _keys[7] — aucun résidu
  const players = [_keys[6], _keys[7], _keys[8]];
  const STAKE = ethers.parseEther("10");
  const FEE = (STAKE * 250n) / 10000n;

  console.log("=== DÉPÔTS ESCROW (registerForPool) 3 x 10 ===");
  const treasuryBefore = await ro.treasuryBalances(owner);
  for (const p of players) {
    const c = new ethers.Contract(addr, art.abi, new ethers.Wallet(p.pk, provider));
    const tx = await c.registerForPool(POOL_ID, STAKE, { value: STAKE + FEE });
    await tx.wait();
  }
  console.log("poolTotal =", fmt(await ro.poolTotal(POOL_ID)), "ETH (attendu 30)");
  for (const p of players) {
    console.log(`  escrow ${p.addr.slice(0,6)} = ${fmt(await ro.poolEscrow(POOL_ID, p.addr))} ETH`);
  }
  const treasuryAfterDep = await ro.treasuryBalances(owner);
  console.log("treasury delta =", fmt(treasuryAfterDep - treasuryBefore), "ETH (attendu 0.75)");

  // === CLAIM unique winner-take-all → champion _keys[9] ===
  const champion = _keys[9]; // gagnant NEUF, pas dans le pool
  const amount = ethers.parseEther("30");
  console.log("\n=== CLAIM unique (claimPool) champion", champion.addr.slice(0,8), "pot 30 ===");
  const res = await fetch(`${BACKEND}/withdraw/claim-pool-voucher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pool_id: POOL_ID, winner_address: champion.addr, amount_wei: amount.toString() })
  });
  const v = await res.json();
  if (!v.signature) {
    console.error("VOUCHER REFUSÉ:", v.error || JSON.stringify(v));
    process.exit(1);
  }
  const cn = new ethers.Contract(addr, art.abi, new ethers.Wallet(champion.pk, provider));
  const tx = await cn.claimPool(BigInt(v.pool_id), BigInt(v.amount), BigInt(v.nonce), v.signature);
  await tx.wait();
  console.log("claimPool tx ok, hash:", tx.hash);

  // === VÉRIF ===
  console.log("\n=== SOLDES FINAUX ===");
  console.log(`Champion ${champion.addr.slice(0,8)} ETH (wallet) = ${fmt(await cn.claimPool === undefined ? 0n : 0n)}`);
  const bal = await provider.getBalance(champion.addr);
  console.log(`Champion wallet ETH = ${fmt(bal)} (attendu incl. le pot 30)`);
  for (const p of players) console.log(`  escrow ${p.addr.slice(0,8)} = ${fmt(await ro.poolEscrow(POOL_ID, p.addr))} ETH (attendu 0)`);
  console.log(`poolTotal = ${fmt(await ro.poolTotal(POOL_ID))} (attendu 0)`);
  console.log(`poolSettled = ${await ro.poolSettled(POOL_ID)} (attendu true)`);
  const treasuryFinal = await ro.treasuryBalances(owner);
  console.log(`treasury delta final = ${fmt(treasuryFinal - treasuryBefore)} (attendu 0.75)`);
}

main().catch(e => { console.error("ERREUR:", e.reason || e.message); process.exit(1); });