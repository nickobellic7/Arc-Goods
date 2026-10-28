import { isAddress, parseAbi, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { Shirt, Coffee, ShoppingBag, StickyNote, Sticker, Glasses, Droplets, BookOpen, type LucideIcon } from 'lucide-react'
import { getUsdc } from '@/onchain-facts'

export const SHOP_CHAIN = arcTestnet
export const SHOP_CHAIN_ID = arcTestnet.id

const rawShopAddress = import.meta.env.VITE_SHOP_ADDRESS as string | undefined
export const SHOP_ADDRESS: Address | undefined =
  rawShopAddress && isAddress(rawShopAddress) ? rawShopAddress : undefined

const usdcFact = getUsdc(SHOP_CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')
export const USDC_ADDRESS = usdcFact.address as Address

export const shopAbi = parseAbi([
  'function checkout(uint256[] ids, uint256[] qtys, uint256 maxTotal) returns (uint256 orderId)',
  'function getProducts() view returns (uint256[] ids, uint256[] prices, bool[] actives)',
  'function getBuyerOrderIds(address buyer) view returns (uint256[])',
  'function getOrder(uint256 orderId) view returns (address buyer, uint256 timestamp, uint256 total, uint256[] ids, uint256[] qtys)',
  'function merchant() view returns (address)',
  'event OrderPlaced(uint256 indexed orderId, address indexed buyer, uint256 total, uint256[] ids, uint256[] qtys)',
])

export interface ProductMeta {
  name: string
  blurb: string
  icon: LucideIcon
  tint: string
  fg: string
}

/** Presentation for catalog ids 1..8. Prices and availability always come from the contract. */
export const PRODUCT_META: Record<number, ProductMeta> = {
  1: { name: 'Arc Tee', blurb: 'Heavyweight cotton, stitched wordmark.', icon: Shirt, tint: '#dbe8fb', fg: '#1061a6' },
  2: { name: 'Studio Hoodie', blurb: 'Brushed fleece in deep navy.', icon: Shirt, tint: '#e2dcf7', fg: '#5b45a8' },
  3: { name: 'Dad Cap', blurb: 'Six-panel, adjustable strap.', icon: Glasses, tint: '#fde9c9', fg: '#a8680f' },
  4: { name: 'Canvas Tote', blurb: 'Carries a week of groceries.', icon: ShoppingBag, tint: '#d9f2e3', fg: '#1a8047' },
  5: { name: 'Ceramic Mug', blurb: 'Matte glaze, 12 oz.', icon: Coffee, tint: '#fbdde1', fg: '#ba2b4c' },
  6: { name: 'Sticker Pack', blurb: 'Ten die-cut vinyl stickers.', icon: Sticker, tint: '#e6f3fb', fg: '#1b6c9a' },
  7: { name: 'Dot Notebook', blurb: 'A5, 120 pages, lay-flat.', icon: BookOpen, tint: '#f3ecdc', fg: '#7a5d1e' },
  8: { name: 'Steel Bottle', blurb: 'Insulated, keeps cold for 24h.', icon: Droplets, tint: '#dff3f2', fg: '#12797a' },
}

export const FALLBACK_META: ProductMeta = {
  name: 'Item',
  blurb: 'Added by the store.',
  icon: StickyNote,
  tint: '#ececf3',
  fg: '#334155',
}

export const metaFor = (id: number): ProductMeta => {
  const meta = PRODUCT_META[id]
  return meta ?? { ...FALLBACK_META, name: `Item #${id}` }
}

/** Raw USDC prices (6 decimals) used to seed the on-chain catalog, ids 1..8. */
export const SEED_PRICES = [2_000_000n, 5_000_000n, 1_500_000n, 1_000_000n, 750_000n, 250_000n, 1_250_000n, 2_500_000n]

export const MAX_QTY = 20
