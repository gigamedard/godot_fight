import { ethers } from "ethers";
import fs from "fs";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const keyA = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // compte #0
const keyB = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // compte #1
const walletA = new ethers.Wallet(keyA, provider);
const walletB = new ethers.Wallet(keyB, provider);
const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json", "utf8"));
const contract = new ethers.Contract(address, artifact.abi, walletA);

// 1. Dépôts (mise 10 ETH chacun)
let tx = await contract.deposit({ value: ethers.parseEther("10") });
await tx.wait();
tx = await contract.connect(walletB).deposit({ value: ethers.parseEther("10") });
await tx.wait();
console.log("Balances après dépôts : A =", ethers.formatEther(await contract.userBalances(walletA.address)), "B =", ethers.formatEther(await contract.userBalances(walletB.address)));

// 2. Voucher de règlement backend (A gagne contre B)
const res = await fetch("http://127.0.0.1:8000/api/withdraw/settle-voucher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ winner_address: walletA.address, loser_address: walletB.address })
});
const data = await res.json();
console.log("Voucher settle :", data.signature.slice(0, 30), "...");
if (!res.ok || !data.signature) { console.log("ECHEC voucher settle:", data); process.exit(1); }

// 3. settleLoser par le gagnant
tx = await contract.settleLoser(data.winner, data.loser, data.signature);
await tx.wait();
console.log("settleLoser OK, tx:", tx.hash);
console.log("Balances après settle : A =", ethers.formatEther(await contract.userBalances(walletA.address)), "B =", ethers.formatEther(await contract.userBalances(walletB.address)));

// 4. Le gagnant claim le pot (20 ETH)
const pot = await contract.userBalances(walletA.address);
const vres = await fetch("http://127.0.0.1:8000/api/withdraw/voucher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet_address: walletA.address, amount_wei: pot.toString() })
});
const vdata = await vres.json();
console.log("Voucher withdraw pot :", vdata.signature.slice(0, 30), "...");
tx = await contract.withdraw(BigInt(vdata.amount), BigInt(vdata.nonce), vdata.signature);
await tx.wait();
console.log("withdraw du pot OK, tx:", tx.hash);
console.log("Balance finale A :", ethers.formatEther(await contract.userBalances(walletA.address)), "B :", ethers.formatEther(await contract.userBalances(walletB.address)));
