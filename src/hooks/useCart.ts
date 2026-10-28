import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_QTY } from '@/lib/shop'
import type { Product } from '@/hooks/useCatalog'

const STORAGE_KEY = 'arc-goods-cart-v1'

export type CartLines = Record<number, number>

function load(): CartLines {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: CartLines = {}
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key)
      const qty = Number(value)
      if (Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0) out[id] = Math.min(qty, MAX_QTY)
    }
    return out
  } catch {
    return {}
  }
}

export function useCart(products: Product[]) {
  const [lines, setLines] = useState<CartLines>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const setQty = useCallback((id: number, qty: number) => {
    setLines((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(qty, MAX_QTY)
      return next
    })
  }, [])

  const add = useCallback(
    (id: number) => setLines((prev) => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, MAX_QTY) })),
    [],
  )

  const clear = useCallback(() => setLines({}), [])

  // Only keep lines for products that exist and are currently on sale.
  const items = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    return Object.entries(lines)
      .map(([key, qty]) => {
        const product = byId.get(Number(key))
        return product?.active ? { product, qty } : null
      })
      .filter((line): line is { product: Product; qty: number } => line !== null)
  }, [lines, products])

  const total = useMemo(() => items.reduce((sum, { product, qty }) => sum + product.price * BigInt(qty), 0n), [items])
  const count = useMemo(() => items.reduce((sum, { qty }) => sum + qty, 0), [items])

  return { items, total, count, add, setQty, clear }
}
