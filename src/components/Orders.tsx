import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { Receipt } from 'lucide-react'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { SHOP_ADDRESS, SHOP_CHAIN_ID, metaFor, shopAbi } from '@/lib/shop'

const usd = (raw: bigint) => `$${Amount.fromRaw(raw, usdcDecimalsFor(SHOP_CHAIN_ID)).toFixed(2)}`

interface ParsedOrder {
  timestamp: bigint
  total: bigint
  lines: { id: number; qty: bigint }[]
}

function parseOrder(value: unknown): ParsedOrder | null {
  if (!Array.isArray(value) || value.length !== 5) return null
  const [, timestamp, total, ids, qtys] = value as unknown[]
  if (typeof timestamp !== 'bigint' || typeof total !== 'bigint') return null
  if (!Array.isArray(ids) || !Array.isArray(qtys)) return null
  const idList = ids as bigint[]
  const qtyList = qtys as bigint[]
  const lines = idList.map((id, k) => ({ id: Number(id), qty: qtyList[k] ?? 0n }))
  return { timestamp, total, lines }
}

export function Orders({ refreshKey }: { refreshKey: string }) {
  const { address } = useAccount()

  const ids = useReadContract({
    address: SHOP_ADDRESS,
    abi: shopAbi,
    functionName: 'getBuyerOrderIds',
    args: address ? [address] : undefined,
    chainId: SHOP_CHAIN_ID,
    query: { enabled: Boolean(address && SHOP_ADDRESS), refetchInterval: 20_000 },
    scopeKey: `orders-${refreshKey}`,
  })

  const recent = [...(ids.data ?? [])].reverse().slice(0, 8)

  const orders = useReadContracts({
    contracts: recent.map((orderId) => ({
      address: SHOP_ADDRESS,
      abi: shopAbi,
      functionName: 'getOrder' as const,
      args: [orderId] as const,
      chainId: SHOP_CHAIN_ID,
    })),
    query: { enabled: recent.length > 0 && Boolean(SHOP_ADDRESS) },
  })

  if (!address) return null

  return (
    <section className="mt-10">
      <h2 className="display mb-3 text-xl font-bold" style={{ color: 'var(--ink)' }}>
        Your orders
      </h2>

      {recent.length === 0 ? (
        <div className="glass-card flex items-center gap-3 rounded-3xl p-5">
          <div className="glass-inner flex size-11 items-center justify-center rounded-2xl">
            <Receipt className="size-5" style={{ color: 'var(--subtle)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {ids.isLoading ? 'Loading your orders...' : 'No orders yet. Receipts show up here after you pay.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recent.map((orderId, i) => {
            const order = parseOrder(orders.data?.[i]?.result)
            if (!order) {
              return (
                <li key={orderId.toString()} className="glass-card h-16 animate-pulse rounded-2xl" />
              )
            }
            return (
              <li key={orderId.toString()} className="glass-card rounded-2xl p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Order #{orderId.toString()}
                  </span>
                  <span className="display text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {usd(order.total)}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {order.lines.map((line) => `${line.qty.toString()} x ${metaFor(line.id).name}`).join(', ')}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--subtle)' }}>
                  {new Date(Number(order.timestamp) * 1000).toLocaleString()}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
