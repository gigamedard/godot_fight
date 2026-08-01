import { ethers } from "ethers";
import fs from "fs";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = new ethers.Wallet(key, provider);
const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
const contract = new ethers.Contract(address, artifact.abi, wallet);

const res = await fetch("http://127.0.0.1:8000/api/withdraw/voucher", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wallet_address: wallet.address,
    amount_wei: "500000000000000000"
  })
});
const data = await res.json();
console.log("Voucher backend : amount=", data.amount, " nonce=", data.nonce.toString(), " sig=", data.signature.slice(0, 30), "...");
if (!res.ok || !data.signature) { console.log("ECHEC voucher:", data); process.exit(1); }

const tx = await contract.withdraw(BigInt(data.amount), BigInt(data.nonce), data.signature);
await tx.wait();
console.log("withdraw OK, tx:", tx.hash);

const bal = await contract.userBalances(wallet.address);
console.log("Balance après withdraw :", ethers.formatEther(bal), "ETH");

const ethBal = await provider.getBalance(wallet.address);
console.log("ETH du compte #0 :", ethers.formatEther(ethBal), "ETH");
