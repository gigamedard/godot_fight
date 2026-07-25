import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const mnemonic = "test test test test test test test test test test test junk";
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(provider);
  
  // Use the second account for backend signer in tests
  const backendSignerWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, "m/44'/60'/0'/0/1").connect(provider);

  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const game = await factory.deploy(backendSignerWallet.address);
  await game.waitForDeployment();

  console.log(`CombatGame deployed to: ${await game.getAddress()}`);
  console.log(`Backend Signer set to: ${backendSignerWallet.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
