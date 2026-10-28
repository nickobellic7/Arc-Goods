import { motion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import { formatUsdc } from '@/onchain-money'
import { metaFor } from '@/lib/shop'
import type { Product } from '@/hooks/useCatalog'

interface ProductGridProps {
  products: Product[]
  isLoading: boolean
  inCart: Record<number, number>
  onAdd: (id: number) => void
}

const price = (raw: bigint) => `$${Number(formatUsdc(raw)).toFixed(2)}`

function Skeleton() {
  return (
    <div className="glass-card animate-pulse rounded-3xl p-3">
      <div className="aspect-[4/3] rounded-2xl bg-black/5" />
      <div className="mt-3 h-4 w-2/3 rounded bg-black/5" />
      <div className="mt-2 h-3 w-full rounded bg-black/5" />
    </div>
  )
}

export function ProductGrid({ products, isLoading, inCart, onAdd }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    )
  }

  const visible = products.filter((p) => p.active)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {visible.map((product, index) => {
        const meta = metaFor(product.id)
        const Icon = meta.icon
        const qty = inCart[product.id] ?? 0
        return (
          <motion.article
            key={product.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: index * 0.03 }}
            className="glass-card flex flex-col rounded-3xl p-3"
          >
            <div
              className="flex aspect-[4/3] items-center justify-center rounded-2xl"
              style={{ background: meta.tint }}
            >
              <Icon className="size-12" strokeWidth={1.5} style={{ color: meta.fg }} />
            </div>
            <div className="mt-3 flex-1 px-1">
              <h3 className="display text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                {meta.name}
              </h3>
              <p className="mt-0.5 text-pretty text-xs leading-snug" style={{ color: 'var(--muted)' }}>
                {meta.blurb}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {price(product.price)}
              </span>
              <button
                onClick={() => onAdd(product.id)}
                aria-label={`Add ${meta.name} to cart`}
                className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-xs font-semibold text-white transition-transform hover:scale-105 active:scale-95"
                style={{ background: 'var(--accent)' }}
              >
                {qty > 0 ? (
                  <>
                    <Check className="size-4" />
                    <span className="tabular-nums">{qty}</span>
                  </>
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            </div>
          </motion.article>
        )
      })}
    </div>
  )
}
