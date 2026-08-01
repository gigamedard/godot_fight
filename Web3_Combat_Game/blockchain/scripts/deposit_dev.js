import { ethers } from "ethers";
import fs from "fs";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = new ethers.Wallet(key, provider);
const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
const contract = new ethers.Contract(address, artifact.abi, wallet);

const bal = await contract.userBalances(wallet.address);
console.log("Balance avant deposit :", ethers.formatEther(bal), "ETH");

const tx = await contract.deposit({ value: ethers.parseEther("0.5") });
await tx.wait();
console.log("Deposit OK, tx:", tx.hash);

const bal2 = await contract.userBalances(wallet.address);
console.log("Balance après deposit :", ethers.formatEther(bal2), "ETH");
