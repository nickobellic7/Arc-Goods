# Arc Goods

A shopping app on Arc Testnet where you browse a small catalog, fill a cart, and pay in USDC from your own wallet. Payments go straight to the store's payout wallet, and each order is recorded onchain so you can see your order history.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Browse products with live prices and availability.
- Add items to a cart that is remembered in your browser.
- Connect a browser wallet and pay in USDC on Arc Testnet.
- See your past orders and a link to each payment on the block explorer.

## Tech stack

- React 18, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Solidity 0.8.28 with Foundry and OpenZeppelin
- Arc Testnet (chain ID 5042002), USDC for payments and gas

## Development

### Prerequisites

- [Bun](https://bun.sh)
- [Foundry](https://book.getfoundry.sh) (only to build or test the contract)
- A browser wallet such as MetaMask, with test USDC on Arc Testnet (get it from https://faucet.circle.com)

### Install

```bash
bun install
```

### Environment variables

| Name | Purpose |
| --- | --- |
| `VITE_SHOP_ADDRESS` | Address of the deployed store contract on Arc Testnet. The shop stays empty until this is set. |

Vite reads `.env` only at startup, so restart the dev server after changing it.

### Run

```bash
bun run dev
```

### Build and check

```bash
bun run contracts:build   # compile the contract
bun run contracts:test    # run contract tests
bun run check             # lint and typecheck
```

## Contract

The store contract lives in `contracts/ArcShop.sol`. When deploying it, you provide the USDC token address, the wallet that receives payments, an owner address, and the starting list of product prices in USDC base units (6 decimals).
