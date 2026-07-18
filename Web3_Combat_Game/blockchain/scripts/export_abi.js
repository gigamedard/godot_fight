import fs from "fs";

const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/CombatGame.sol/CombatGame.json", "utf8"));
const jsContent = `const COMBAT_GAME_ABI = ${JSON.stringify(artifact.abi, null, 2)};`;
fs.writeFileSync("../frontend/contract_abi.js", jsContent);
console.log("ABI exported to frontend/contract_abi.js");
