import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs, getAddress, type Address, type Hex } from 'viem';
import artifact from '/home/user/app/contracts/out/ArcShop.sol/ArcShop.json' with { type: 'json' };

const RPC = process.env.ARCSHOP_TEST_RPC ?? 'http://127.0.0.1:44701';
let SHOP = '0x04acFF4B7c828714b7E3A8aBacca6DB67c998cc9' as Address;
const USDC = '0x3600000000000000000000000000000000000000' as Address;
const DEPLOYER = '0x8E3c431a9F1f314bf108dC459C03eee2ed128e7a' as Address;
const FACTORY = '0x935b7e427831f138570bb36508bb0dea22921715' as Address;
const PRICES = [2000000n, 5000000n, 1500000n, 1000000n, 750000n, 250000n, 1250000n, 2500000n];
const abi = (artifact as any).abi;
const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);

const pub = createPublicClient({ transport: http(RPC) });
const wallet = createWalletClient({ transport: http(RPC) });
const raw = async (method: string, params: any[]) => {
  const r: any = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json());
  if (r.error) throw new Error(`${method}: ${r.error.message}`);
  return r.result;
};
const hex = (n: bigint) => '0x' + n.toString(16);
// native wei on Arc is 18 decimals; USDC ERC20 view is 6 decimals
const fundUsdc = async (a: Address, usdc: bigint) => { await raw('anvil_setBalance', [a, hex(usdc * 10n ** 12n)]); };
const imp = async (a: Address) => { await raw('anvil_impersonateAccount', [a]); await fundUsdc(a, 100_000_000n); };

let failed = 0, passed = 0;
const results: Record<string, 'PASS' | 'FAIL'> = {};
async function test(fn: string, name: string, body: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const detail = await body();
    passed++; results[`${fn}: ${name}`] = 'PASS';
    console.log(JSON.stringify({ testName: `${fn}: ${name}`, status: 'PASS', detail: detail ?? '', durationMs: Date.now() - t0 }));
  } catch (e: any) {
    failed++; results[`${fn}: ${name}`] = 'FAIL';
    console.log(JSON.stringify({ testName: `${fn}: ${name}`, status: 'FAIL', actual: String(e?.shortMessage ?? e?.message ?? e).slice(0, 400), durationMs: Date.now() - t0 }));
  }
}
const assert = (c: any, m: string) => { if (!c) throw new Error('assert: ' + m); };
const eq = (a: any, b: any, m: string) => { if (a !== b) throw new Error(`${m}: expected ${b} got ${a}`); };

const rd = (fn: string, args: any[] = []) => pub.readContract({ address: SHOP, abi, functionName: fn, args }) as Promise<any>;
const bal = (a: Address) => pub.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [a] });
async function send(from: Address, fn: string, args: any[], address: Address = SHOP, a: any = abi) {
  const hash = await wallet.writeContract({ account: { address: from, type: 'json-rpc' } as any, chain: null, address, abi: a, functionName: fn, args } as any);
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error(`tx reverted ${hash}`);
  return { hash, rc };
}
async function expectRevert(from: Address, fn: string, args: any[], errorName?: string) {
  try {
    await pub.simulateContract({ account: from, address: SHOP, abi, functionName: fn, args } as any);
  } catch (e: any) {
    const name = e?.walk?.((x: any) => x?.data?.errorName)?.data?.errorName;
    if (errorName && name !== errorName) throw new Error(`expected ${errorName}, got ${name ?? e.shortMessage}`);
    return name ?? 'revert';
  }
  throw new Error(`expected revert${errorName ? ' ' + errorName : ''} but call succeeded`);
}
async function newBuyer(n: number, usdc = 100_000_000n): Promise<Address> {
  const a = getAddress('0x' + (0xb0b00000n + BigInt(n)).toString(16).padStart(40, '0')) as Address;
  await imp(a); await fundUsdc(a, usdc); return a;
}
const approve = (buyer: Address, amt: bigint) => send(buyer, 'approve', [SHOP, amt], USDC, erc20);
const total = (ids: number[], qtys: number[]) => ids.reduce((s, id, i) => s + PRICES[id - 1] * BigInt(qtys[i]), 0n);

async function main() {
  await imp(DEPLOYER); await imp(FACTORY);
  if (process.env.ARCSHOP_DEPLOY_LOCAL) {
    // Arc-precompile-aware fork: the predicted CREATE2 address does not exist here, so deploy the same artifact + ctor args from the deployer.
    const hash = await wallet.deployContract({ account: { address: DEPLOYER, type: 'json-rpc' } as any, chain: null, abi, bytecode: (artifact as any).bytecode.object as Hex, args: [USDC, DEPLOYER, DEPLOYER, PRICES] } as any);
    const rc = await pub.waitForTransactionReceipt({ hash });
    SHOP = rc.contractAddress as Address; console.log(JSON.stringify({ note: 'deployed locally', address: SHOP, tx: hash }));
  }
  const OWNER = DEPLOYER;
  const outsider = await newBuyer(900);

  await test('constructor/views', 'config matches deploy args', async () => {
    const code = await pub.getCode({ address: SHOP });
    assert(code && code !== '0x', 'code at predicted address');
    eq((await rd('usdc')).toLowerCase(), USDC.toLowerCase(), 'usdc');
    eq((await rd('merchant')).toLowerCase(), DEPLOYER.toLowerCase(), 'merchant');
    eq((await rd('owner')).toLowerCase(), DEPLOYER.toLowerCase(), 'owner');
    eq(await rd('productCount'), 8n, 'productCount');
    eq(await rd('orderCount'), 0n, 'orderCount');
  });
  await test('getProducts/products', 'catalog matches constructor prices, all active', async () => {
    const [ids, prices, actives] = await rd('getProducts');
    eq(ids.length, 8, 'len');
    for (let i = 0; i < 8; i++) { eq(ids[i], BigInt(i + 1), 'id'); eq(prices[i], PRICES[i], 'price'); eq(actives[i], true, 'active'); }
    const p = await rd('products', [3n]);
    eq(p[0], 1500000n, 'products(3).price'); eq(p[1], true, 'products(3).active');
  });
  await test('owner', 'factory (CREATE2 deployer) is not the owner; explicit owner is', async () => {
    assert((await rd('owner')).toLowerCase() !== FACTORY.toLowerCase(), 'owner must not be factory');
    await expectRevert(FACTORY, 'setMerchant', [FACTORY], 'OwnableUnauthorizedAccount');
  });

  // ---- checkout: allowance
  const buyer = await newBuyer(1);
  await test('checkout', 'reverts without allowance (no state change)', async () => {
    await expectRevert(buyer, 'checkout', [[1n], [1n], 10_000_000n]);
    eq(await rd('orderCount'), 0n, 'orderCount');
  });
  await test('checkout', 'reverts when allowance < total', async () => {
    await approve(buyer, 1_999_999n);
    await expectRevert(buyer, 'checkout', [[1n], [1n], 10_000_000n]);
  });

  // ---- maxTotal
  await test('checkout', 'maxTotal protection: total > maxTotal reverts TotalExceedsMaximum, no funds move', async () => {
    await approve(buyer, 50_000_000n);
    const t = total([1, 3], [2, 1]); // 5.5 USDC
    const before = await bal(buyer);
    const e = await expectRevert(buyer, 'checkout', [[1n, 3n], [2n, 1n], t - 1n], 'TotalExceedsMaximum');
    eq(await bal(buyer), before, 'buyer balance unchanged'); eq(await rd('orderCount'), 0n, 'orderCount');
    return e;
  });

  // ---- success
  const ids = [1n, 3n], qtys = [2n, 1n]; const T = total([1, 3], [2, 1]);
  await test('checkout', 'success: merchant receives exact total, buyer pays total (+gas), allowance consumed, event emitted', async () => {
    const mBefore = await bal(DEPLOYER), bBefore = await bal(buyer);
    const aBefore = await pub.readContract({ address: USDC, abi: erc20, functionName: 'allowance', args: [buyer, SHOP] });
    const { hash, rc } = await send(buyer, 'checkout', [ids, qtys, T]);
    const mAfter = await bal(DEPLOYER), bAfter = await bal(buyer);
    eq(mAfter - mBefore, T, 'merchant delta');
    const fee = (rc.gasUsed * rc.effectiveGasPrice) / 10n ** 12n;
    const paid = bBefore - bAfter;
    assert(paid >= T && paid <= T + fee + 1n, `buyer paid ${paid} not within [${T}, ${T + fee + 1n}]`);
    eq(await pub.readContract({ address: USDC, abi: erc20, functionName: 'allowance', args: [buyer, SHOP] }), aBefore - T, 'allowance decrement');
    const ev = parseEventLogs({ abi, logs: rc.logs, eventName: 'OrderPlaced' }) as any[];
    eq(ev.length, 1, 'OrderPlaced count'); eq(ev[0].args.orderId, 1n, 'orderId'); eq(ev[0].args.total, T, 'ev total');
    eq(ev[0].args.buyer.toLowerCase(), buyer.toLowerCase(), 'ev buyer');
    eq(await bal(SHOP), 0n, 'shop holds no USDC');
    return `tx ${hash}; total ${T}`;
  });
  await test('getOrder/orderCount/getBuyerOrderIds', 'order recorded and viewable', async () => {
    eq(await rd('orderCount'), 1n, 'orderCount');
    const o = await rd('getOrder', [1n]);
    eq(o[0].toLowerCase(), buyer.toLowerCase(), 'buyer'); eq(o[2], T, 'total');
    assert(o[1] > 0n, 'timestamp'); 
    eq(JSON.stringify(o[3].map(String)), JSON.stringify(['1', '3']), 'ids'); eq(JSON.stringify(o[4].map(String)), JSON.stringify(['2', '1']), 'qtys');
    eq(JSON.stringify((await rd('getBuyerOrderIds', [buyer])).map(String)), '["1"]', 'buyer ids');
    eq((await rd('getBuyerOrderIds', [outsider])).length, 0, 'other buyer ids empty');
  });
  await test('getOrder', 'unknown order IDs (0, count+1) revert UnknownOrder', async () => {
    await expectRevert(buyer, 'getOrder', [0n], 'UnknownOrder');
    await expectRevert(buyer, 'getOrder', [2n], 'UnknownOrder');
  });
  await test('checkout', 'exact maxTotal == total accepted; duplicate IDs allowed; 2nd order id=2; multi-order buyer index', async () => {
    const t = total([2, 2], [1, 3]);
    const mBefore = await bal(DEPLOYER);
    const { hash } = await send(buyer, 'checkout', [[2n, 2n], [1n, 3n], t]);
    eq((await bal(DEPLOYER)) - mBefore, t, 'merchant delta');
    eq(await rd('orderCount'), 2n, 'orderCount');
    eq(JSON.stringify((await rd('getBuyerOrderIds', [buyer])).map(String)), '["1","2"]', 'ids');
    eq((await rd('getOrder', [2n]))[2], t, 'order2 total');
    return `tx ${hash}`;
  });
  await test('checkout', 'max lines (20) and max qty (100) accepted', async () => {
    const b = await newBuyer(2, 3000_000_000n);
    const idsL = Array(20).fill(6n), qL = Array(20).fill(100n); const t = 250000n * 100n * 20n;
    await approve(b, t);
    const mBefore = await bal(DEPLOYER);
    const { hash } = await send(b, 'checkout', [idsL, qL, t]);
    eq((await bal(DEPLOYER)) - mBefore, t, 'merchant delta');
    return `tx ${hash}; total ${t}`;
  });
  await test('checkout', 'cart/quantity/id validation reverts', async () => {
    const b = await newBuyer(3); await approve(b, 1_000_000_000n); const M = 10n ** 12n;
    await expectRevert(b, 'checkout', [[], [], M], 'InvalidCart');
    await expectRevert(b, 'checkout', [[1n, 2n], [1n], M], 'InvalidCart');
    await expectRevert(b, 'checkout', [Array(21).fill(1n), Array(21).fill(1n), M], 'InvalidCart');
    await expectRevert(b, 'checkout', [[1n], [0n], M], 'InvalidQuantity');
    await expectRevert(b, 'checkout', [[1n], [101n], M], 'InvalidQuantity');
    await expectRevert(b, 'checkout', [[0n], [1n], M], 'UnknownProduct');
    await expectRevert(b, 'checkout', [[9n], [1n], M], 'UnknownProduct');
  });
  await test('checkout', 'insufficient USDC balance reverts atomically (no order recorded)', async () => {
    const b = await newBuyer(4, 1_000_000n); await approve(b, 1_000_000_000n);
    const before = await rd('orderCount');
    await expectRevert(b, 'checkout', [[2n], [1n], 10_000_000n]);
    eq(await rd('orderCount'), before, 'orderCount'); eq((await rd('getBuyerOrderIds', [b])).length, 0, 'buyer ids');
  });

  // ---- owner functions
  await test('setProduct', 'non-owner reverts OwnableUnauthorizedAccount', async () => {
    await expectRevert(outsider, 'setProduct', [1n, 1n, true], 'OwnableUnauthorizedAccount');
  });
  await test('setProduct', 'owner updates price/active, emits ProductSet; checkout uses new price', async () => {
    const { hash, rc } = await send(OWNER, 'setProduct', [4n, 3_000_000n, true]);
    const ev = parseEventLogs({ abi, logs: rc.logs, eventName: 'ProductSet' }) as any[];
    eq(ev.length, 1, 'event'); eq(ev[0].args.price, 3_000_000n, 'ev price');
    eq((await rd('products', [4n]))[0], 3_000_000n, 'price');
    const b = await newBuyer(5); await approve(b, 10_000_000n);
    const mBefore = await bal(DEPLOYER);
    await send(b, 'checkout', [[4n], [2n], 6_000_000n]);
    eq((await bal(DEPLOYER)) - mBefore, 6_000_000n, 'merchant delta at new price');
    await send(OWNER, 'setProduct', [4n, PRICES[3], true]);
    return `tx ${hash}`;
  });
  await test('setProduct', 'append productCount+1 works; id 0 and productCount+2 revert UnknownProduct; price 0 / >uint128 revert InvalidPrice', async () => {
    const { hash } = await send(OWNER, 'setProduct', [9n, 4_000_000n, true]);
    eq(await rd('productCount'), 9n, 'productCount');
    const [ids] = await rd('getProducts'); eq(ids.length, 9, 'catalog len');
    await expectRevert(OWNER, 'setProduct', [11n, 1n, true], 'UnknownProduct');
    await expectRevert(OWNER, 'setProduct', [0n, 1n, true], 'UnknownProduct');
    await expectRevert(OWNER, 'setProduct', [1n, 0n, true], 'InvalidPrice');
    await expectRevert(OWNER, 'setProduct', [1n, 2n ** 128n, true], 'InvalidPrice');
    return `tx ${hash}`;
  });
  await test('checkout', 'inactive product reverts InactiveProduct; reactivated product purchasable', async () => {
    await send(OWNER, 'setProduct', [2n, PRICES[1], false]);
    const b = await newBuyer(6); await approve(b, 100_000_000n);
    const before = await rd('orderCount'); const bb = await bal(b);
    await expectRevert(b, 'checkout', [[1n, 2n], [1n, 1n], 100_000_000n], 'InactiveProduct');
    eq(await rd('orderCount'), before, 'orderCount'); eq(await bal(b), bb, 'balance');
    const [, , actives] = await rd('getProducts'); eq(actives[1], false, 'active flag false');
    await send(OWNER, 'setProduct', [2n, PRICES[1], true]);
    const { hash } = await send(b, 'checkout', [[2n], [1n], PRICES[1]]);
    return `tx ${hash}`;
  });
  await test('setMerchant', 'non-owner reverts; zero address reverts', async () => {
    await expectRevert(outsider, 'setMerchant', [outsider], 'OwnableUnauthorizedAccount');
    await expectRevert(OWNER, 'setMerchant', ['0x0000000000000000000000000000000000000000'], 'ZeroAddress');
  });
  await test('setMerchant', 'owner changes merchant; future payments go to new merchant only', async () => {
    const newM = getAddress('0x00000000000000000000000000000000000cafe1') as Address;
    await fundUsdc(newM, 0n);
    const { hash, rc } = await send(OWNER, 'setMerchant', [newM]);
    const ev = parseEventLogs({ abi, logs: rc.logs, eventName: 'MerchantSet' }) as any[];
    eq(ev.length, 1, 'event'); eq(ev[0].args.merchant.toLowerCase(), newM.toLowerCase(), 'ev merchant');
    eq((await rd('merchant')).toLowerCase(), newM.toLowerCase(), 'merchant');
    const b = await newBuyer(7); await approve(b, 10_000_000n);
    const oldBefore = await bal(DEPLOYER), newBefore = await bal(newM);
    const t = total([5, 7], [4, 2]);
    await send(b, 'checkout', [[5n, 7n], [4n, 2n], t]);
    eq((await bal(newM)) - newBefore, t, 'new merchant delta exact');
    eq(await bal(DEPLOYER), oldBefore, 'old merchant unchanged');
    // restore
    await send(OWNER, 'setMerchant', [DEPLOYER]);
    return `tx ${hash}`;
  });
  await test('ownership', 'non-owner cannot transferOwnership / renounceOwnership', async () => {
    await expectRevert(outsider, 'transferOwnership', [outsider], 'OwnableUnauthorizedAccount');
    await expectRevert(outsider, 'renounceOwnership', [], 'OwnableUnauthorizedAccount');
  });
}

try { await main(); } catch (e: any) { failed++; console.log(JSON.stringify({ testName: 'setup', status: 'FAIL', actual: String(e?.message ?? e).slice(0, 400) })); }
console.log(JSON.stringify({ summary: { passed, failed } }));
process.exit(failed ? 1 : 0);
