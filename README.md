# Fortress

Fortress is a non-custodial yield vault on Snow Chain, an EVM appchain built on Initia.

## Initia Hackathon Submission

- **Project Name**: Fortress

### Project Overview

Fortress is a yield vault built on Snow Chain. Users deposit SNW tokens into the smart contract, yield accrues automatically at 5% APY calculated per second, and they can withdraw their full balance plus earned yield in a single transaction at any time. The app is designed to make DeFi as simple as possible for anyone.

### Implementation Detail

- **The Custom Implementation**: FlowVault.sol is a Solidity smart contract that tracks each user deposit balance and deposit timestamp. On withdrawal, it calculates yield based on exactly how many seconds the tokens were held, then transfers principal plus yield back in one transaction.
- **The Native Feature**: The app implements the Interwoven Bridge flow. The Bridge section explains how to move assets from Initia L1 to Snow Chain using Initia's native bridge protocol, with step by step instructions and direct links to the faucet and bridge interface.

### How to Run Locally

1. Run weave rollup start -d then weave opinit start executor -d
2. cd flowvault-frontend and run npm install
3. Run npm run dev
4. Open http://localhost:3001 and connect your wallet
