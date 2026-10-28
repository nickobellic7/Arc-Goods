import { useReadContract } from 'wagmi'
import { SHOP_ADDRESS, SHOP_CHAIN_ID, shopAbi } from '@/lib/shop'

export interface Product {
  id: number
  price: bigint
  active: boolean
}

/** Live catalog (ids, prices, availability) read straight from the store contract. */
export function useCatalog() {
  const query = useReadContract({
    address: SHOP_ADDRESS,
    abi: shopAbi,
    functionName: 'getProducts',
    chainId: SHOP_CHAIN_ID,
    query: { enabled: Boolean(SHOP_ADDRESS), refetchInterval: 15_000 },
  })

  const products: Product[] = query.data
    ? query.data[0].map((id, i) => ({
        id: Number(id),
        price: query.data[1][i] ?? 0n,
        active: query.data[2][i] ?? false,
      }))
    : []

  return { products, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
