const hre = require('hardhat');
const { join } = require('path');
const { readFileSync } = require('fs');

// Import the ABI of the contract from the flipper_evm.json file.
const abi = require("../target/ink/flipper.json").output.abi;

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    // Fetch the bytecode of the contract.
    const bytecodePath = join(__dirname, "../target/ink", "flipper.polkavm");
    const bytecode = `0x${readFileSync(bytecodePath).toString('hex')}`;

    const flipper = new hre.ethers.ContractFactory(abi, bytecode, deployer);

    // Deploy the contract with the constructor arguments.
    const contract = await flipper.deploy(true);
    await contract.waitForDeployment();
    
    // Get the address of the deployed contract.
    const address = await contract.getAddress();
    console.log(`Contract deployed at: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});