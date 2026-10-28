import { ConnectKitButton } from 'connectkit'
import { ShoppingBag } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { SHOP_CHAIN_ID } from '@/lib/shop'

interface HeaderProps {
  balance: bigint | undefined
  count: number
  onOpenCart: () => void
}

export function Header({ balance, count, onOpenCart }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
          <ShoppingBag className="size-[18px] text-white" />
        </div>
        <div className="leading-tight">
          <div className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            Arc Goods
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
            Pay in USDC
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {balance !== undefined && (
          <div
            className="glass-pill hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold tabular-nums sm:flex"
            style={{ color: 'var(--ink)' }}
            title="Your USDC balance on Arc Testnet"
          >
            <TokenUSDC variant="branded" size={16} />
            {Amount.fromRaw(balance, usdcDecimalsFor(SHOP_CHAIN_ID)).toFixed(2)}
          </div>
        )}
        <button
          onClick={onOpenCart}
          aria-label={`Open cart, ${count} items`}
          className="glass-pill relative flex size-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
          style={{ color: 'var(--ink)' }}
        >
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums text-white"
              style={{ background: 'var(--accent)', height: 20 }}
            >
              {count}
            </span>
          )}
        </button>
        <ConnectKitButton.Custom>
          {({ isConnected, show, truncatedAddress }) => (
            <button
              onClick={show}
              className="h-11 rounded-full px-4 text-xs font-semibold text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              {isConnected ? truncatedAddress : 'Connect'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
