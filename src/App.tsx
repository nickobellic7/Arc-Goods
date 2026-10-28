import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldCheck, Zap } from 'lucide-react'
import { Header } from '@/components/Header'
import { ProductGrid } from '@/components/ProductGrid'
import { CartSheet } from '@/components/CartSheet'
import { Orders } from '@/components/Orders'
import { useCatalog } from '@/hooks/useCatalog'
import { useCart } from '@/hooks/useCart'
import { useCheckout } from '@/hooks/useCheckout'
import { SHOP_ADDRESS, SHOP_CHAIN_ID } from '@/lib/shop'
import { buildAddressExplorerUrl } from '@/onchain-facts'

export default function App() {
  const catalog = useCatalog()
  const cart = useCart(catalog.products)
  const checkout = useCheckout(cart.clear)
  const [cartOpen, setCartOpen] = useState(false)

  const inCart = useMemo(() => Object.fromEntries(cart.items.map(({ product, qty }) => [product.id, qty])), [cart.items])

  // Changes once per confirmed purchase so the order list refetches.
  const ordersKey = checkout.status === 'success' ? (checkout.orderHash ?? 'done') : 'idle'

  const add = (id: number) => {
    cart.add(id)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          style={{
            position: 'absolute',
            top: '6%',
            left: '4%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(133,177,237,0.22) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '8%',
            right: '6%',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,205,131,0.20) 0%, transparent 70%)',
            filter: 'blur(58px)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-24">
        <Header balance={checkout.balance} count={cart.count} onOpenCart={() => setCartOpen(true)} />

        <section className="glass-card mb-6 rounded-3xl p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--subtle)' }}>
            Spring drop
          </p>
          <h1 className="display mt-2 text-balance text-4xl font-bold sm:text-5xl" style={{ color: 'var(--ink)' }}>
            Everyday goods, paid in USDC.
          </h1>
          <p className="mt-3 max-w-[56ch] text-pretty text-sm sm:text-base" style={{ color: 'var(--muted)' }}>
            Check out in seconds on Arc. Your payment goes straight from your wallet to the store, and every order is
            recorded onchain.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium" style={{ color: 'var(--ink-2)' }}>
            <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2">
              <Zap className="size-3.5" /> Sub-second finality
            </span>
            <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2">
              <ShieldCheck className="size-3.5" /> Non-custodial checkout
            </span>
          </div>
        </section>

        {!SHOP_ADDRESS ? (
          <div className="glass-card flex items-start gap-3 rounded-3xl p-5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--danger)' }} />
            <div>
              <p className="display font-semibold" style={{ color: 'var(--ink)' }}>
                The store contract is not connected yet
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                Deploy the store contract and set <span className="mono text-xs">VITE_SHOP_ADDRESS</span> to open the
                shelf.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                Shop
              </h2>
              <a
                href={buildAddressExplorerUrl(SHOP_CHAIN_ID, SHOP_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-[11px] underline-offset-2 hover:underline"
                style={{ color: 'var(--subtle)' }}
              >
                Store contract
              </a>
            </div>
            {catalog.isError ? (
              <p role="alert" className="glass-card rounded-3xl p-5 text-sm" style={{ color: 'var(--danger)' }}>
                Could not load the catalog from Arc Testnet.{' '}
                <button className="font-semibold underline" onClick={() => void catalog.refetch()}>
                  Retry
                </button>
              </p>
            ) : (
              <ProductGrid
                products={catalog.products}
                isLoading={catalog.isLoading}
                inCart={inCart}
                onAdd={add}
              />
            )}
            <Orders refreshKey={ordersKey} />
          </>
        )}
      </div>

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        total={cart.total}
        setQty={cart.setQty}
        checkout={checkout}
      />
    </div>
  )
}
