require('@parity/hardhat-polkadot');
require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
//   solidity: "0.8.28",
//   resolc: {
//         compilerSource: 'npm',
//     },
    networks: {
        hardhat: {
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: './bin/substrate-node',
                dev: true,
                rpcPort: 8000
            },
            adapterConfig: {
                adapterBinaryPath: './bin/eth-rpc',
                dev: true,
            },
        },
        polkadotHubTestnet: {
            polkavm: true,
            url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
            accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
        },
    }
};
