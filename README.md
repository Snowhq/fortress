# Fortress — Yield Vault on Snow Chain

Fortress is a non-custodial yield vault built on Snow Chain, an EVM appchain within the Initia ecosystem.

Live demo: https://fortress-rho.vercel.app

## Initia Hackathon Submission

Project Name: Fortress

### Project Overview

Fortress is a yield vault built on Snow Chain. Users deposit SNW tokens into the smart contract, yield accrues automatically at 5% APY calculated per second, and they can withdraw their principal plus earned yield anytime in a single transaction. The app is designed to make DeFi as simple as possible for anyone.

### Implementation Detail

The Custom Implementation: Fortress.sol is a Solidity smart contract that tracks each user deposit balance and deposit timestamp. On withdrawal, it calculates yield based on exactly how many seconds the tokens were held, then transfers principal plus yield back in one transaction.

The Native Feature: Fortress is built on Snow Chain, a custom EVM rollup within the Initia ecosystem. The Interwoven Bridge is Initia's native cross-chain protocol that connects Initia L1 to appchains like Snow Chain. The Bridge page in the app demonstrates this protocol and explains the intended production flow. Snow Chain is currently running as a cloud-hosted node and is not registered in the public Initia bridge UI. For this demo, users fund their wallet using the built-in Faucet to get SNW tokens and interact with the vault directly.

### How to Run Locally

1. Run weave rollup start -d then weave opinit start executor -d
2. cd flowvault-frontend and run npm install
3. Run npm run dev
4. Open http://localhost:3000 and connect your wallet

### Cloud Infrastructure

Snow Chain RPC: https://fortress-node-production.up.railway.app

Frontend: https://fortress-rho.vercel.app

The contract deploys automatically on chain restart via a Docker startup script hosted on Railway.
