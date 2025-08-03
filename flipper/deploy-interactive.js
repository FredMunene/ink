const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Network configuration for Polkadot Hub Testnet
const NETWORK_CONFIG = {
  name: 'Polkadot Hub Testnet',
  rpcUrl: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
  chainId: 420420422
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function deployContract() {
  try {
    console.log('🚀 Flipper Smart Contract Deployment');
    console.log('=====================================');
    console.log('Network:', NETWORK_CONFIG.name);
    console.log('RPC URL:', NETWORK_CONFIG.rpcUrl);
    console.log('');
    
    // Get private key from user
    console.log('📝 Please enter your private key (starts with 0x):');
    console.log('💡 You can get this from MetaMask → Account Details → Export Private Key');
    const privateKey = await askQuestion('Private Key: ');
    
    if (!privateKey || !privateKey.startsWith('0x')) {
      console.error('❌ Invalid private key format. Must start with 0x');
      process.exit(1);
    }

    // Connect to the network
    console.log('\n🔗 Connecting to network...');
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📝 Deployer address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'PAS');
    
    if (balance === 0n) {
      console.error('❌ No balance! Get test tokens from: https://faucet.polkadot.io/?parachain=1111');
      const proceed = await askQuestion('Do you want to continue anyway? (y/N): ');
      if (proceed.toLowerCase() !== 'y') {
        process.exit(1);
      }
    }

    // Load contract files
    console.log('\n📄 Loading contract files...');
    const abiPath = path.join(__dirname, 'target/ink/flipper.abi');
    const metadataPath = path.join(__dirname, 'target/ink/flipper.json');
    const bytecodePath = path.join(__dirname, 'target/ink/flipper.polkavm');

    // Check if we have the Solidity ABI file
    let abi;
    if (fs.existsSync(abiPath)) {
      console.log('📄 Using Solidity ABI file...');
      abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    } else if (fs.existsSync(metadataPath)) {
      console.log('📄 Converting ink! metadata to Solidity ABI...');
      // Create a basic Solidity ABI from ink! metadata
      abi = [
        {
          "type": "constructor",
          "inputs": [{"name": "init_value", "type": "bool"}],
          "stateMutability": "nonpayable"
        },
        {
          "type": "function",
          "name": "flip",
          "inputs": [],
          "outputs": [],
          "stateMutability": "nonpayable"
        },
        {
          "type": "function",
          "name": "get",
          "inputs": [],
          "outputs": [{"name": "", "type": "bool"}],
          "stateMutability": "view"
        }
      ];
    } else {
      console.error('❌ Contract files not found in target/ink/');
      console.log('Available files:');
      if (fs.existsSync('target/ink')) {
        fs.readdirSync('target/ink').forEach(file => console.log('  -', file));
      }
      console.log('\nMake sure you built the contract first:');
      console.log('  cargo contract build --release --metadata solidity');
      process.exit(1);
    }

    if (!fs.existsSync(bytecodePath)) {
      console.error('❌ Contract bytecode not found:', bytecodePath);
      process.exit(1);
    }

    const bytecode = '0x' + fs.readFileSync(bytecodePath).toString('hex');
    
    console.log('✅ Contract ABI loaded');
    console.log('✅ Contract bytecode loaded');

    // Ask for constructor parameter
    console.log('\n🔧 Constructor Configuration:');
    const initialValue = await askQuestion('Enter initial boolean value (true/false) [default: true]: ');
    const initValue = initialValue.toLowerCase() === 'false' ? false : true;
    console.log('📊 Initial value will be:', initValue);

    // Confirm deployment
    const confirm = await askQuestion('\n🚀 Ready to deploy? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Deployment cancelled');
      process.exit(0);
    }

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Deploy with constructor argument
    console.log('\n🔄 Deploying contract...');
    const contract = await contractFactory.deploy(initValue);
    
    console.log('⏳ Waiting for deployment confirmation...');
    console.log('📋 Transaction hash:', contract.deploymentTransaction().hash);
    
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log('\n✅ Contract deployed successfully!');
    console.log('📍 Contract address:', contractAddress);
    
    // Test the contract
    console.log('\n🧪 Testing contract functionality...');
    const currentValue = await contract.get();
    console.log('📊 Current value:', currentValue);
    
    const testFlip = await askQuestion('Test flip function? (y/N): ');
    if (testFlip.toLowerCase() === 'y') {
      console.log('🔄 Calling flip()...');
      const flipTx = await contract.flip();
      console.log('⏳ Waiting for transaction...');
      await flipTx.wait();
      
      const newValue = await contract.get();
      console.log('📊 New value after flip:', newValue);
    }
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('=====================================');
    console.log('📋 Deployment Summary:');
    console.log('   Network:', NETWORK_CONFIG.name);
    console.log('   Contract Address:', contractAddress);
    console.log('   Deployer:', wallet.address);
    console.log('   Initial Value:', initValue);
    console.log('   Current Value:', await contract.get());
    
    // Save deployment info
    const deploymentInfo = {
      network: NETWORK_CONFIG.name,
      chainId: NETWORK_CONFIG.chainId,
      contractAddress: contractAddress,
      deployerAddress: wallet.address,
      initialValue: initValue,
      deploymentTime: new Date().toISOString(),
      transactionHash: contract.deploymentTransaction().hash
    };
    
    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('💾 Deployment info saved to deployment.json');
    
    console.log('\n🔗 Next steps:');
    console.log('1. Update your frontend with the contract address:', contractAddress);
    console.log('2. Use the ABI file: target/ink/flipper.abi');
    console.log('3. Test your dApp with the deployed contract');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('💡 Get test tokens from: https://faucet.polkadot.io/?parachain=1111');
    }
  } finally {
    rl.close();
  }
}

// Run deployment
deployContract();
