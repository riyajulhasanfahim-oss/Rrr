import { 
  confirmVendorResellerOrder, 
  getVendorWalletBalances, 
  checkResellerOrderEligibility 
} from '../src/services/vendorResellerOrderService';
import { rtdbSet, rtdbGet } from '../src/lib/rtdb';

async function runVendorConfirmOrderValidationTests() {
  console.log('\n========================================================================');
  console.log(' VENDOR CONFIRM RESELLER ORDER: ৳8890 BALANCE VALIDATION TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName}`);
      passed++;
    } else {
      console.error(`  \x1b[31m✗ [FAIL]\x1b[0m ${testName}`, details || '');
      failed++;
    }
  }

  const vendorId = `test_vendor_8890_${Date.now()}`;
  const orderId = `ORD_8890_${Date.now()}`;

  // =========================================================================
  // TEST CASE 1: EXACT MATCH (Available = 8890, Required Profit = 8890) -> CONFIRM ALLOWED
  // =========================================================================
  console.log('\x1b[1mTest 1: Required Profit = ৳8890, Available Balance = ৳8890 (Equal Balance)\x1b[0m');
  
  // Set up vendor wallet in RTDB with exactly 8890
  await rtdbSet(`vendor_wallet/${vendorId}`, {
    vendorId,
    availableBalance: 8890,
    lockedBalance: 0,
    totalBalance: 8890,
    balance: 8890,
    currentBalance: 8890,
    resellerProfitReserve: 0,
    updatedAt: Date.now()
  });

  // Set up reseller order in RTDB with required profit of 8890
  await rtdbSet(`vendor_orders/${orderId}`, {
    id: orderId,
    orderId,
    vendorId,
    resellerId: 'test_reseller_123',
    isResellerOrder: true,
    resellerProfit: 8890,
    lockedProfitAmount: 8890,
    priceSnapshot: {
      resellerProfit: 8890,
      vendorPrice: 1110,
      resellerSellingPrice: 10000,
      quantity: 1
    },
    status: 'Pending',
    orderStatus: 'Pending',
    profitStatus: 'PENDING',
    vendorOrderStatus: 'PENDING',
    createdAt: Date.now()
  });

  // Verify eligibility check: Available (8890) >= Required (8890)
  const walletBefore = await getVendorWalletBalances(vendorId);
  const eligibility = checkResellerOrderEligibility(
    { isResellerOrder: true, resellerProfit: 8890, status: 'Pending' }, 
    walletBefore
  );

  assert(
    eligibility.isBalanceSufficient === true && eligibility.canConfirm === true,
    'Eligibility Check: Available (৳8890) >= Required (৳8890) -> ALLOWED (isBalanceSufficient=true, canConfirm=true)',
    eligibility
  );

  // Execute confirmVendorResellerOrder
  const confirmResult = await confirmVendorResellerOrder(orderId, vendorId);

  assert(
    confirmResult.success === true,
    'Confirm Result: "অর্ডার কনফার্ম করুন" succeeded with zero false balance error',
    confirmResult
  );

  // Verify wallet state in RTDB after confirmation:
  // Available should decrease by 8890 -> 0
  // Locked should increase by 8890 -> 8890
  // Total balance preserved -> 8890
  const walletAfter = await getVendorWalletBalances(vendorId);
  assert(
    walletAfter.availableBalance === 0,
    'Wallet State: availableBalance decreased from ৳8890 to ৳0',
    walletAfter
  );
  assert(
    walletAfter.lockedBalance === 8890,
    'Wallet State: lockedBalance increased from ৳0 to ৳8890',
    walletAfter
  );
  assert(
    walletAfter.totalBalance === 8890,
    'Wallet Consistency: totalBalance strictly preserved at ৳8890 (total = available + locked)',
    walletAfter
  );

  // Verify order state in RTDB
  const orderAfter = await rtdbGet<any>(`vendor_orders/${orderId}`);
  assert(
    orderAfter.vendorOrderStatus === 'CONFIRMED' && orderAfter.profitStatus === 'LOCKED',
    'Order State: vendorOrderStatus is CONFIRMED and profitStatus is LOCKED',
    { vendorOrderStatus: orderAfter?.vendorOrderStatus, profitStatus: orderAfter?.profitStatus }
  );

  // =========================================================================
  // TEST CASE 2: INSUFFICIENT BALANCE (Available = 8889, Required Profit = 8890) -> CONFIRM BLOCKED
  // =========================================================================
  console.log('\n\x1b[1mTest 2: Required Profit = ৳8890, Available Balance = ৳8889 (Insufficient Balance)\x1b[0m');

  const vendorIdInsufficient = `test_vendor_insufficient_${Date.now()}`;
  const orderIdInsufficient = `ORD_INSUFFICIENT_${Date.now()}`;

  // Set up wallet with 8889 (1 taka short)
  await rtdbSet(`vendor_wallet/${vendorIdInsufficient}`, {
    vendorId: vendorIdInsufficient,
    availableBalance: 8889,
    lockedBalance: 0,
    totalBalance: 8889,
    balance: 8889,
    updatedAt: Date.now()
  });

  // Set up order requiring 8890
  await rtdbSet(`vendor_orders/${orderIdInsufficient}`, {
    id: orderIdInsufficient,
    orderId: orderIdInsufficient,
    vendorId: vendorIdInsufficient,
    resellerId: 'test_reseller_123',
    isResellerOrder: true,
    resellerProfit: 8890,
    status: 'Pending',
    profitStatus: 'PENDING',
    vendorOrderStatus: 'PENDING'
  });

  const walletBeforeInsuff = await getVendorWalletBalances(vendorIdInsufficient);
  const eligibilityInsuff = checkResellerOrderEligibility(
    { isResellerOrder: true, resellerProfit: 8890, status: 'Pending' }, 
    walletBeforeInsuff
  );

  assert(
    eligibilityInsuff.isBalanceSufficient === false && eligibilityInsuff.shortfall === 1,
    'Eligibility Check: Available (৳8889) < Required (৳8890) -> BLOCKED with shortfall of ৳1',
    eligibilityInsuff
  );

  const confirmResultInsuff = await confirmVendorResellerOrder(orderIdInsufficient, vendorIdInsufficient);
  assert(
    confirmResultInsuff.success === false && confirmResultInsuff.error === 'INSUFFICIENT_WALLET_BALANCE',
    'Confirm Result: Confirmation blocked with INSUFFICIENT_WALLET_BALANCE error',
    confirmResultInsuff
  );

  // Verify wallet did NOT change
  const walletAfterInsuff = await getVendorWalletBalances(vendorIdInsufficient);
  assert(
    walletAfterInsuff.availableBalance === 8889 && walletAfterInsuff.lockedBalance === 0,
    'Wallet State: Balance untouched after blocked attempt (Available=8889, Locked=0)',
    walletAfterInsuff
  );

  // =========================================================================
  // TEST CASE 3: STRING & CURRENCY FORMATTED NUMBERS
  // =========================================================================
  console.log('\n\x1b[1mTest 3: Formatting & String Comparison Guards (৳8,890 as string or formatted)\x1b[0m');

  const vendorIdStr = `test_vendor_str_${Date.now()}`;
  const orderIdStr = `ORD_STR_${Date.now()}`;

  // Stored as string with Bengali currency or commas
  await rtdbSet(`vendor_wallet/${vendorIdStr}`, {
    vendorId: vendorIdStr,
    availableBalance: '8890',
    lockedBalance: '0',
    totalBalance: '8890',
    balance: '8890'
  });

  await rtdbSet(`vendor_orders/${orderIdStr}`, {
    id: orderIdStr,
    orderId: orderIdStr,
    vendorId: vendorIdStr,
    resellerId: 'test_reseller_str',
    isResellerOrder: true,
    resellerProfit: '8890',
    status: 'Pending',
    profitStatus: 'PENDING',
    vendorOrderStatus: 'PENDING'
  });

  const confirmStrRes = await confirmVendorResellerOrder(orderIdStr, vendorIdStr);
  assert(
    confirmStrRes.success === true,
    'String Formatting: "8890" as string successfully parsed and confirmed',
    confirmStrRes
  );

  const walletStrAfter = await getVendorWalletBalances(vendorIdStr);
  assert(
    walletStrAfter.availableBalance === 0 && walletStrAfter.lockedBalance === 8890,
    'String Formatting: Wallet properly updated (Available=0, Locked=8890)',
    walletStrAfter
  );

  console.log('\n========================================================================');
  console.log('                          TEST SUMMARY                                  ');
  console.log('========================================================================');
  console.log(`Total Checks : ${passed + failed}`);
  console.log(`Passed       : \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed       : ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);
  if (failed === 0) {
    console.log('\x1b[1m\x1b[32m✓ ALL ৳8890 BALANCE VALIDATION TESTS COMPLETED SUCCESSFULLY!\x1b[0m\n');
  } else {
    console.error('\x1b[1m\x1b[31m✗ SOME TESTS FAILED!\x1b[0m\n');
    process.exit(1);
  }
}

runVendorConfirmOrderValidationTests().then(() => process.exit(0)).catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
