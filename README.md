# Fortress — Yield Vault on Snow Chain

Fortress is a non-custodial yield vault built on Snow Chain, an EVM appchain on Initia.

## Initia Hackathon Submission

- **Project Name**: Fortress

### Project Overview
Fortress is a yield vault built on Snow Chain. Users deposit SNW tokens into the smart contract, yield accrues automatically at 5% APY calculated per second, and they can withdraw their principal plus earned yield anytime in a single transaction.

### Implementation Detail
- **The Custom Implementation**: Fortress.sol is a Solidity smart contract that tracks each user deposit balance and deposit timestamp. On withdrawal, it calculates yield based on exactly how many seconds the tokens were held, then transfers principal plus yield back in one transaction.
- **The Native Feature**: Interwoven Bridge — the app implements the full intended bridge flow from Initia L1 to Snow Chain. The Bridge page explains the user flow and links to Initia bridge infrastructure. Note: Snow Chain runs locally as a custom rollup. The bridge UI only supports registered chains, so the actual bridge transaction cannot be completed in this local dev environment — but the full flow is implemented as per hackathon guidelines.

### How to Run Locally
1. Run `weave rollup start -d` then `weave opinit start executor -d`
2. `cd flowvault-frontend` and run `npm install`
3. Run `npm run dev`
4. Open http://localhost:3000 and connect your wallet
