import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const mnemonic = "test test test test test test test test test test test junk";
  const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic).connect(provider);

  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const game = await factory.deploy();
  await game.waitForDeployment();

  console.log(`CombatGame deployed to: ${await game.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
