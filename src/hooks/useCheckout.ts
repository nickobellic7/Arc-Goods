import { useCallback, useState } from 'react'
import { erc20Abi, type Hash } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { SHOP_ADDRESS, SHOP_CHAIN_ID, USDC_ADDRESS, shopAbi } from '@/lib/shop'

export type CheckoutStatus = 'idle' | 'approving' | 'purchasing' | 'success' | 'error'

export interface CheckoutLine {
  id: number
  qty: number
}

export function parseOnchainError(error: unknown): string | null {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return null
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Not enough USDC to cover this order and network fees.'
  }
  if (message.includes('totalexceedsmaximum')) return 'A price changed while you were checking out. Review your cart and try again.'
  if (message.includes('inactiveproduct')) return 'An item in your cart is no longer available.'
  if (message.includes('reverted')) return 'The transaction was rejected by the store contract.'
  if (message.includes('network') || message.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}

export function useCheckout(onPurchased?: () => void) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: SHOP_CHAIN_ID })

  const [status, setStatus] = useState<CheckoutStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approveHash, setApproveHash] = useState<Hash>()
  const [orderHash, setOrderHash] = useState<Hash>()

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: SHOP_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  })

  const allowance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && SHOP_ADDRESS ? [address, SHOP_ADDRESS] : undefined,
    chainId: SHOP_CHAIN_ID,
    query: { enabled: Boolean(address && SHOP_ADDRESS) },
  })

  const wrongChain = isConnected && chainId !== SHOP_CHAIN_ID

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setApproveHash(undefined)
    setOrderHash(undefined)
  }, [])

  const run = useCallback(
    async (lines: CheckoutLine[], total: bigint) => {
      if (!SHOP_ADDRESS || !address || !publicClient) return
      setError(null)
      setApproveHash(undefined)
      setOrderHash(undefined)
      try {
        if (wrongChain) await switchChainAsync({ chainId: SHOP_CHAIN_ID })

        const currentAllowance = (await allowance.refetch()).data ?? 0n
        if (currentAllowance < total) {
          setStatus('approving')
          const hash = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [SHOP_ADDRESS, total],
            chainId: SHOP_CHAIN_ID,
          })
          setApproveHash(hash)
          const approval = await publicClient.waitForTransactionReceipt({ hash })
          if (approval.status !== 'success') throw new Error('Approval reverted')
        }

        setStatus('purchasing')
        const hash = await writeContractAsync({
          address: SHOP_ADDRESS,
          abi: shopAbi,
          functionName: 'checkout',
          args: [lines.map((l) => BigInt(l.id)), lines.map((l) => BigInt(l.qty)), total],
          chainId: SHOP_CHAIN_ID,
        })
        setOrderHash(hash)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Checkout reverted')

        setStatus('success')
        onPurchased?.()
        void balance.refetch()
        void allowance.refetch()
      } catch (e) {
        const friendly = parseOnchainError(e)
        if (friendly === null) {
          setStatus('idle')
        } else {
          setError(friendly)
          setStatus('error')
        }
      }
    },
    [address, allowance, balance, onPurchased, publicClient, switchChainAsync, wrongChain, writeContractAsync],
  )

  return {
    run,
    reset,
    status,
    error,
    approveHash,
    orderHash,
    wrongChain,
    balance: balance.data,
    balanceLoading: balance.isLoading,
    refetchBalance: balance.refetch,
    busy: status === 'approving' || status === 'purchasing',
  }
}
