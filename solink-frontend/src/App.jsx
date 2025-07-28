import { useState } from 'react'
import './App.css'

function App() {
  const [account, setAccount] = useState('')
  const [contract, setContract] = useState(null)
  const [flipperValue, setFlipperValue] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const CONTRACT_ADDRESS = '0x996AAdCB6Df82386c56c05CC691d4c96DE8fd38A'

  // Network configuration
  const NETWORK_CONFIG = {
    chainId: '0x190f1b46', // 1111 in hex (Polkadot Hub Testnet)
    chainName: 'Paseo PassetHub',
    rpcUrls: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    nativeCurrency: {
      name: 'PAS',
      symbol: 'PAS',
      decimals: 18, // EVM-compatible decimals
    },
  }

  // Solidity ABI generated from ink! contract
  const CONTRACT_ABI = [
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
  ]

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('MetaMask not found! Please install MetaMask.')
        return
      }

      // Dynamic import of ethers to avoid loading issues
      const { ethers } = await import('ethers')

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      // Add/switch to Polkadot Hub Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK_CONFIG.chainId }],
        })
      } catch (switchError) {
        // Network doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_CONFIG],
          })
        }
      }

      // Setup provider and contract
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      setAccount(accounts[0])
      setContract(contractInstance)
      setError('✅ Connected! Contract instance created. Try "Get Value" to test contract interaction.')

      // Don't automatically call the contract on connection to avoid immediate errors
    } catch (err) {
      setError('Failed to connect: ' + err.message)
    }
  }

  // Get current flipper value
  const getCurrentValue = async (contractInstance = contract) => {
    try {
      setLoading(true)
      setError('')

      // Try to call the contract with error handling
      console.log('Attempting to call contract.get()...')
      const value = await contractInstance.get()
      console.log('Contract returned:', value)
      setFlipperValue(value)
      setError('✅ Successfully read from contract!')
    } catch (err) {
      console.error('Contract call error:', err)
      setError(`Failed to get value: ${err.message}. This might be due to ABI compatibility issues with ink! contracts.`)
      setFlipperValue(null)
    } finally {
      setLoading(false)
    }
  }

  // Flip the value
  const flipValue = async () => {
    try {
      setLoading(true)
      setError('')

      console.log('Attempting to call contract.flip()...')
      const tx = await contract.flip()
      console.log('Transaction sent:', tx.hash)

      setError('⏳ Transaction sent, waiting for confirmation...')
      await tx.wait()

      setError('✅ Transaction confirmed! Refreshing value...')
      await getCurrentValue()
    } catch (err) {
      console.error('Flip transaction error:', err)
      setError(`Failed to flip: ${err.message}. This might be due to ABI compatibility or gas issues.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔗 Solink - ink! Contract Demo</h1>
        <p>Bridging ink! contracts with Ethereum tooling</p>

        <div className="contract-info">
          <h3>📋 Contract Information</h3>
          <p><strong>Network:</strong> Paseo PassetHub (Chain ID: 420420422)</p>
          <p><strong>Contract:</strong> {CONTRACT_ADDRESS}</p>
        </div>

        {!account ? (
          <button onClick={connectWallet} className="connect-btn">
            🦊 Connect MetaMask
          </button>
        ) : (
          <div className="connected">
            <p>✅ Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>

            <div className="flipper-controls">
              <div className="value-display">
                <h3>Current Value:</h3>
                <div className="value">
                  {loading ? '⏳ Loading...' :
                   flipperValue !== null ? (flipperValue ? '✅ TRUE' : '❌ FALSE') : '❓ Unknown'}
                </div>
              </div>

              <div className="buttons">
                <button onClick={() => getCurrentValue()} disabled={loading}>
                  📖 Get Value
                </button>
                <button onClick={flipValue} disabled={loading}>
                  🔄 Flip Value
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="error">
            ⚠️ {error}
          </div>
        )}

        <footer>
          <p>Built by Polkadot Kisumu Team</p>
        </footer>
      </header>
    </div>
  )
}

export default App
