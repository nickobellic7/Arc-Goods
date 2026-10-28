import { AnimatePresence, motion } from 'framer-motion'
import { useModal } from 'connectkit'
import { useAccount } from 'wagmi'
import { CheckCircle2, ExternalLink, Loader2, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { MAX_QTY, SHOP_CHAIN_ID, metaFor } from '@/lib/shop'
import type { Product } from '@/hooks/useCatalog'
import type { useCheckout } from '@/hooks/useCheckout'

interface CartSheetProps {
  open: boolean
  onClose: () => void
  items: { product: Product; qty: number }[]
  total: bigint
  setQty: (id: number, qty: number) => void
  checkout: ReturnType<typeof useCheckout>
}

const usd = (raw: bigint) => `$${Amount.fromRaw(raw, usdcDecimalsFor(SHOP_CHAIN_ID)).toFixed(2)}`

export function CartSheet({ open, onClose, items, total, setQty, checkout }: CartSheetProps) {
  const { isConnected } = useAccount()
  const { setOpen: openConnect } = useModal()
  const { status, error, busy, wrongChain, balance, orderHash, approveHash } = checkout

  const insufficient = balance !== undefined && balance < total
  const done = status === 'success'

  const close = () => {
    if (busy) return
    if (done) checkout.reset()
    onClose()
  }

  const submit = () => {
    if (!isConnected) return openConnect(true)
    void checkout.run(
      items.map(({ product, qty }) => ({ id: product.id, qty })),
      total,
    )
  }

  let label = `Pay ${usd(total)} USDC`
  if (!isConnected) label = 'Connect wallet to pay'
  else if (wrongChain) label = 'Switch to Arc Testnet and pay'
  else if (insufficient) label = 'Not enough USDC'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <motion.section
            role="dialog"
            aria-label="Your cart"
            className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:max-h-none sm:rounded-none sm:rounded-l-3xl"
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spectral h-1 shrink-0" />
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                {done ? 'Order placed' : 'Your cart'}
              </h2>
              <button
                onClick={close}
                aria-label="Close cart"
                className="flex size-11 items-center justify-center rounded-full hover:bg-black/5"
                style={{ color: 'var(--muted)' }}
              >
                <X className="size-5" />
              </button>
            </div>

            {done ? (
              <div className="space-y-4 px-5 pb-6 pt-2">
                <div className="glass-inner rounded-2xl p-5 text-center">
                  <CheckCircle2 className="mx-auto size-10" style={{ color: 'var(--success)' }} />
                  <p className="display mt-3 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                    Payment confirmed
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    Your USDC went straight to the store. The order is recorded onchain.
                  </p>
                  {orderHash && (
                    <a
                      href={buildTxExplorerUrl(SHOP_CHAIN_ID, orderHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      View on explorer <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={close}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  Keep shopping
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 pb-10 pt-8 text-center">
                <div className="glass-inner mx-auto flex size-14 items-center justify-center rounded-2xl">
                  <ShoppingBag className="size-6" style={{ color: 'var(--subtle)' }} />
                </div>
                <p className="display mt-4 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                  Your cart is empty
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  Add something from the shelf to pay with USDC.
                </p>
              </div>
            ) : (
              <>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-2">
                  {items.map(({ product, qty }) => {
                    const meta = metaFor(product.id)
                    const Icon = meta.icon
                    return (
                      <li key={product.id} className="glass-inner flex items-center gap-3 rounded-2xl p-2.5">
                        <div
                          className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: meta.tint }}
                        >
                          <Icon className="size-6" strokeWidth={1.6} style={{ color: meta.fg }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                            {meta.name}
                          </div>
                          <div className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                            {usd(product.price)} each
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            aria-label={`Remove one ${meta.name}`}
                            disabled={busy}
                            onClick={() => setQty(product.id, qty - 1)}
                            className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                          <button
                            aria-label={`Add one ${meta.name}`}
                            disabled={busy || qty >= MAX_QTY}
                            onClick={() => setQty(product.id, qty + 1)}
                            className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="shrink-0 space-y-3 px-5 pb-6 pt-3">
                  <div className="glass-inner space-y-1.5 rounded-2xl p-4 text-sm">
                    <div className="flex justify-between" style={{ color: 'var(--muted)' }}>
                      <span>Shipping</span>
                      <span>Free</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                        Total
                      </span>
                      <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {usd(total)} <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
                      </span>
                    </div>
                    {balance !== undefined && (
                      <div className="flex justify-between text-xs" style={{ color: 'var(--subtle)' }}>
                        <span>Your balance</span>
                        <span className="tabular-nums">{usd(balance)}</span>
                      </div>
                    )}
                  </div>

                  {insufficient && (
                    <p className="text-xs" style={{ color: 'var(--danger)' }}>
                      You need more testnet USDC.{' '}
                      <a
                        href="https://faucet.circle.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline"
                      >
                        Open the faucet
                      </a>
                    </p>
                  )}
                  {status === 'error' && error && (
                    <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
                      {error}
                    </p>
                  )}
                  {busy && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {status === 'approving'
                        ? 'Step 1 of 2: allow the store to take this exact amount of USDC.'
                        : 'Step 2 of 2: confirm your payment.'}
                      {approveHash && status === 'purchasing' ? ' Allowance confirmed.' : ''}
                    </p>
                  )}

                  <button
                    onClick={submit}
                    disabled={busy || (isConnected && insufficient)}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: 'var(--accent)' }}
                  >
                    {busy ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {status === 'approving' ? 'Waiting for allowance...' : 'Confirming payment...'}
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
