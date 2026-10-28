# Arc Goods

## Deployment

- ArcShop (Arc Testnet): 0xbBfa1b7547C6b22Eb4551a81776B8cb107b82a15 (set as `VITE_SHOP_ADDRESS` in `.env`).
- Owner and payout wallet: 0xb7e8cbec6a17afdfbb44737144794c8c9cb84718 (user's Circle developer-controlled wallet, id a0f974af-dcbe-5ba0-977f-c1bfdfbadf0e).
- Deployed via CREATE2 factory 0x59b03f80547a1f5942a2517c1cc0d62b761e8cfa. Metadata: `contracts/contract-metadata/ArcShop.json`.
- Catalog ids 1..8 are seeded onchain; names and icons live in `src/lib/shop.ts`. Prices always come from the contract.

# (original template notes)

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
