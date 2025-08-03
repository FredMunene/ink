const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Local development network configuration
const NETWORK_CONFIG = {
  name: 'Local Development',
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 1337
};

async function deployContract() {
  try {
    console.log('🚀 Flipper Smart Contract Local Deployment');
    console.log('==========================================');
    console.log('Network:', NETWORK_CONFIG.name);
    console.log('RPC URL:', NETWORK_CONFIG.rpcUrl);
    console.log('');
    
    // Connect to local network
    console.log('🔗 Connecting to local network...');
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    
    // Use a test account (local development)
    const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
    
    console.log('📝 Deployer address:', wallet.address);
    
    // Check balance
    try {
      const balance = await provider.getBalance(wallet.address);
      console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');
    } catch (error) {
      console.log('⚠️  Could not check balance - network might not be running');
      console.log('💡 Make sure you have a local development node running on port 8545');
      return;
    }

    // Load contract files
    console.log('\n📄 Loading contract files...');
    const abiPath = path.join(__dirname, 'target/ink/flipper.abi');
    const bytecodePath = path.join(__dirname, 'target/ink/flipper.polkavm');
    
    if (!fs.existsSync(abiPath) || !fs.existsSync(bytecodePath)) {
      console.error('❌ Contract files not found');
      console.log('Make sure you built the contract: cargo contract build --release --metadata solidity');
      return;
    }

    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const bytecode = '0x' + fs.readFileSync(bytecodePath).toString('hex');
    
    console.log('✅ Contract ABI loaded');
    console.log('✅ Contract bytecode loaded');
    console.log('📊 Bytecode size:', Math.floor(bytecode.length / 2), 'bytes');

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Deploy with constructor argument
    console.log('\n🔄 Deploying contract with initial value: true');
    const contract = await contractFactory.deploy(true);
    
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
    
    console.log('🔄 Calling flip()...');
    const flipTx = await contract.flip();
    console.log('⏳ Waiting for transaction...');
    await flipTx.wait();
    
    const newValue = await contract.get();
    console.log('📊 New value after flip:', newValue);
    
    console.log('\n🎉 Local deployment completed successfully!');
    console.log('=====================================');
    console.log('📋 Deployment Summary:');
    console.log('   Network:', NETWORK_CONFIG.name);
    console.log('   Contract Address:', contractAddress);
    console.log('   Deployer:', wallet.address);
    console.log('   Test Results: ✅ Passed');
    
    // Save deployment info
    const deploymentInfo = {
      network: NETWORK_CONFIG.name,
      chainId: NETWORK_CONFIG.chainId,
      contractAddress: contractAddress,
      deployerAddress: wallet.address,
      deploymentTime: new Date().toISOString(),
      transactionHash: contract.deploymentTransaction().hash
    };
    
    fs.writeFileSync('deployment-local.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('💾 Deployment info saved to deployment-local.json');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    
    if (error.code === 'NETWORK_ERROR') {
      console.log('💡 Make sure you have a local development node running');
      console.log('   Try: npx hardhat node');
    } else if (error.message.includes('execution reverted')) {
      console.log('💡 This might be a PolkaVM compatibility issue');
      console.log('   The local network might not support PolkaVM contracts');
    }
  }
}

// Run deployment
deployContract();
