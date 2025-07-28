const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Multiple network configurations to try
const NETWORKS = {
  'polkadot-hub': {
    name: 'Polkadot Hub Testnet',
    rpcUrl: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
    chainId: 420420422,
    faucet: 'https://faucet.polkadot.io/?parachain=1111'
  },
  'local': {
    name: 'Local Development',
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 1337,
    faucet: 'Built-in test accounts'
  }
};

async function testNetwork(networkKey, privateKey) {
  const network = NETWORKS[networkKey];
  console.log(`\n🔍 Testing ${network.name}...`);
  console.log('RPC URL:', network.rpcUrl);
  
  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    // Test connection
    const blockNumber = await provider.getBlockNumber();
    console.log('✅ Connection successful, block number:', blockNumber);
    
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      console.log('💰 Balance:', ethers.formatEther(balance), 'tokens');
      
      if (balance > 0n) {
        console.log('✅ Account has funds');
        return { network, provider, wallet, canDeploy: true };
      } else {
        console.log('⚠️  No balance - get tokens from:', network.faucet);
        return { network, provider, wallet, canDeploy: false };
      }
    }
    
    return { network, provider, canDeploy: false };
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return { network, canDeploy: false };
  }
}

async function deployToNetwork(networkInfo) {
  const { network, provider, wallet } = networkInfo;
  
  console.log(`\n🚀 Deploying to ${network.name}...`);
  
  try {
    // Load contract files
    const abiPath = path.join(__dirname, 'target/ink/flipper.abi');
    const bytecodePath = path.join(__dirname, 'target/ink/flipper.polkavm');
    
    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const bytecode = '0x' + fs.readFileSync(bytecodePath).toString('hex');
    
    console.log('📊 Contract size:', Math.floor(bytecode.length / 2), 'bytes');
    
    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Try to estimate gas first
    console.log('🔍 Estimating gas...');
    try {
      const gasEstimate = await contractFactory.getDeployTransaction(true).then(tx => 
        provider.estimateGas(tx)
      );
      console.log('⛽ Estimated gas:', gasEstimate.toString());
    } catch (gasError) {
      console.log('⚠️  Gas estimation failed:', gasError.message);
      console.log('🔄 Trying deployment anyway...');
    }
    
    // Deploy with constructor argument
    console.log('🔄 Deploying contract...');
    const contract = await contractFactory.deploy(true, {
      gasLimit: 5000000 // Set a high gas limit
    });
    
    console.log('⏳ Waiting for deployment...');
    console.log('📋 Transaction hash:', contract.deploymentTransaction().hash);
    
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log('✅ Contract deployed successfully!');
    console.log('📍 Contract address:', contractAddress);
    
    // Test the contract
    console.log('🧪 Testing contract...');
    const currentValue = await contract.get();
    console.log('📊 Current value:', currentValue);
    
    const flipTx = await contract.flip();
    await flipTx.wait();
    
    const newValue = await contract.get();
    console.log('📊 Value after flip:', newValue);
    
    return {
      success: true,
      contractAddress,
      network: network.name
    };
    
  } catch (error) {
    console.log('❌ Deployment failed:', error.message);
    
    // Provide specific error analysis
    if (error.message.includes('execution reverted')) {
      console.log('💡 Analysis: Contract execution reverted');
      console.log('   - This might be a PolkaVM compatibility issue');
      console.log('   - The network might not support ink! contracts yet');
    } else if (error.message.includes('insufficient funds')) {
      console.log('💡 Analysis: Insufficient funds for gas');
      console.log('   - Get more tokens from:', network.faucet);
    } else if (error.message.includes('nonce')) {
      console.log('💡 Analysis: Nonce issue - try again');
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  try {
    console.log('🔧 ink! Contract Deployment Debugger');
    console.log('====================================');
    
    // Get private key
    const privateKey = await askQuestion('Enter your private key (or press Enter to skip): ');
    
    console.log('\n🔍 Testing available networks...');
    
    const networkResults = [];
    for (const [key, network] of Object.entries(NETWORKS)) {
      const result = await testNetwork(key, privateKey);
      networkResults.push({ key, ...result });
    }
    
    // Find networks that can deploy
    const deployableNetworks = networkResults.filter(n => n.canDeploy);
    
    if (deployableNetworks.length === 0) {
      console.log('\n❌ No networks available for deployment');
      console.log('💡 Make sure you have:');
      console.log('   1. A valid private key');
      console.log('   2. Test tokens from the faucets');
      console.log('   3. A local development node running (for local deployment)');
      return;
    }
    
    console.log('\n✅ Available networks for deployment:');
    deployableNetworks.forEach((n, i) => {
      console.log(`   ${i + 1}. ${n.network.name}`);
    });
    
    const choice = await askQuestion('\nSelect network (1-' + deployableNetworks.length + '): ');
    const selectedNetwork = deployableNetworks[parseInt(choice) - 1];
    
    if (!selectedNetwork) {
      console.log('❌ Invalid selection');
      return;
    }
    
    const result = await deployToNetwork(selectedNetwork);
    
    if (result.success) {
      console.log('\n🎉 Deployment successful!');
      console.log('📋 Summary:');
      console.log('   Network:', result.network);
      console.log('   Contract:', result.contractAddress);
      
      // Save deployment info
      const deploymentInfo = {
        network: result.network,
        contractAddress: result.contractAddress,
        deploymentTime: new Date().toISOString()
      };
      
      fs.writeFileSync('deployment-debug.json', JSON.stringify(deploymentInfo, null, 2));
      console.log('💾 Saved to deployment-debug.json');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

main();
