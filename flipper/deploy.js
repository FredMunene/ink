const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Network configuration for Polkadot Hub Testnet
const NETWORK_CONFIG = {
  name: 'Polkadot Hub Testnet',
  rpcUrl: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
  chainId: 420420422
};

async function deployContract() {
  try {
    console.log('🚀 Starting deployment to Polkadot Hub Testnet...');
    
    // You need to set your private key here
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
      console.error('❌ Please set PRIVATE_KEY environment variable');
      console.log('Example: PRIVATE_KEY=0x... node deploy.js');
      process.exit(1);
    }

    // Connect to the network
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log('📝 Deployer address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'PAS');
    
    if (balance === 0n) {
      console.error('❌ No balance! Get test tokens from: https://faucet.polkadot.io/?parachain=1111');
      process.exit(1);
    }

    // Load contract files
    const abiPath = path.join(__dirname, 'target/ink/flipper.abi');
    
    const bytecodePath = path.join(__dirname, 'target/ink/flipper.polkavm');
    
    if (!fs.existsSync(abiPath) || !fs.existsSync(bytecodePath)) {
      console.error('❌ Contract files not found. Make sure you built the contract first.');
      console.log('Run: cargo contract build --release');
      process.exit(1);
    }

    const abi_ = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const bytecode = '0x' + fs.readFileSync(bytecodePath).toString('hex');
    
    console.log('📄 Contract ABI loaded');
    console.log('💾 Contract bytecode loaded');

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi_.output.abi, bytecode, wallet);
    
    // Deploy with constructor argument (initial value: true)
    console.log('🔄 Deploying contract...');
    const contract = await contractFactory.deploy(true);
    
    console.log('⏳ Waiting for deployment confirmation...');
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log('✅ Contract deployed successfully!');
    console.log('📍 Contract address:', contractAddress);
    
    // Test the contract
    console.log('🧪 Testing contract...');
    const initialValue = await contract.get();
    console.log('📊 Initial value:', initialValue);
    
    console.log('🔄 Calling flip()...');
    const flipTx = await contract.flip();
    await flipTx.wait();
    
    const newValue = await contract.get();
    console.log('📊 New value:', newValue);
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('📋 Summary:');
    console.log('   Network:', NETWORK_CONFIG.name);
    console.log('   Contract Address:', contractAddress);
    console.log('   Initial Value:', initialValue);
    console.log('   After Flip:', newValue);
    
    // Save deployment info
    const deploymentInfo = {
      network: NETWORK_CONFIG.name,
      chainId: NETWORK_CONFIG.chainId,
      contractAddress: contractAddress,
      deployerAddress: wallet.address,
      deploymentTime: new Date().toISOString()
    };
    
    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('💾 Deployment info saved to deployment.json');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployContract();
