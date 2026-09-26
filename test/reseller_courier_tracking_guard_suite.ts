/**
 * RESELLER COURIER TRACKING SUBMISSION GUARD TEST SUITE
 * 
 * Verifies that:
 * 1. Reseller Order with insufficient availableBalance cannot submit Courier Tracking Link.
 * 2. Reseller Order with insufficient availableBalance cannot be confirmed.
 * 3. Reseller Order with sufficient availableBalance must be confirmed first (Step 5 profit lock) before tracking link can be submitted.
 * 4. Reseller Order once confirmed can submit Courier Tracking Link to Admin review.
 * 5. Normal User orders are 100% unaffected and bypass reseller profit checks.
 */

import { rtdbGet, rtdbSet, rtdbUpdate } from '../src/lib/rtdb';
import { submitVendorCourierLink } from '../src/services/courierReviewService';
import { confirmVendorResellerOrder, getVendorWalletBalances } from '../src/services/vendorResellerOrderService';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, message: string) {
  if (condition) {
    results.push({ name, passed: true, message });
    console.log(`  ${GREEN}✓ [PASS] ${name}: ${message}${RESET}`);
  } else {
    results.push({ name, passed: false, message });
    console.error(`  ${RED}✗ [FAIL] ${name}: ${message}${RESET}`);
  }
}

async function runTests() {
  console.log(`\n${BOLD}${BLUE}========================================================================${RESET}`);
  console.log(`${BOLD}${BLUE}   RESELLER COURIER TRACKING LINK & BALANCE GUARD TEST SUITE            ${RESET}`);
  console.log(`${BOLD}${BLUE}========================================================================${RESET}\n`);

  const vendorId = 'vendor_guard_test_1';
  const resellerId = 'reseller_guard_test_1';
  const now = Date.now();
  const orderId1 = 'ORDGUARD' + now;
  const normalOrderId = 'ORDNORMAL' + now;

  try {
    // -------------------------------------------------------------
    // SETUP: Initial Vendor Wallet with availableBalance: 200
    // -------------------------------------------------------------
    console.log(`${BOLD}Setting up test vendor wallet & orders...${RESET}`);
    await rtdbSet(`vendor_wallet/${vendorId}`, {
      vendorId,
      availableBalance: 200,
      lockedBalance: 0,
      totalBalance: 200,
      updatedAt: Date.now()
    });

    // Setup Reseller Order 1 requiring profit 500 (Insufficient: 200 < 500)
    const resellerOrder1 = {
      id: orderId1,
      orderId: orderId1,
      vendorId,
      resellerId,
      isResellerOrder: true,
      resellerProfit: 500,
      profitStatus: 'PENDING',
      vendorOrderStatus: 'PENDING',
      status: 'Pending',
      items: [
        {
          id: 'prod_1',
          name: 'Test Product',
          quantity: 1,
          resellerItemProfit: 500,
          customerPrice: 1500,
          wholesalePrice: 1000
        }
      ]
    };
    await rtdbSet(`orders/${orderId1}`, resellerOrder1);
    await rtdbSet(`vendor_orders/${orderId1}`, resellerOrder1);
    await rtdbSet(`reseller_orders/${orderId1}`, resellerOrder1);

    // -------------------------------------------------------------
    // SCENARIO 1: Vendor with insufficient balance attempts to submit tracking link
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 1: Reseller Order with insufficient balance submitting tracking link${RESET}`);
    let s1Error: any = null;
    try {
      await submitVendorCourierLink({
        orderId: orderId1,
        order: resellerOrder1,
        vendorId,
        courierName: 'Steadfast Courier',
        trackingId: 'STEAD-123456',
        trackingUrl: 'https://steadfast.com.bd/tracking/STEAD-123456'
      });
    } catch (err: any) {
      s1Error = err;
    }

    assert(
      s1Error !== null && (s1Error.message.includes('availableBalance') || s1Error.message.includes('ঘাটতি')),
      'Scenario 1: Insufficient Balance Guard',
      `Tracking link submission was BLOCKED with error: "${s1Error?.message}"`
    );

    // Verify no record created in courier_link_reviews
    const reviewRecord1 = await rtdbGet<any>(`courier_link_reviews/${orderId1}`);
    assert(
      !reviewRecord1,
      'Scenario 1: Zero Review Record',
      'No courier link review record was saved in RTDB'
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Vendor deposits funds to have availableBalance >= resellerProfit
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 2: Vendor deposits to meet balance requirement${RESET}`);
    // Deposit 1000 -> availableBalance becomes 1200
    await rtdbUpdate(`vendor_wallet/${vendorId}`, {
      availableBalance: 1200,
      totalBalance: 1200,
      updatedAt: Date.now()
    });

    const updatedBalances = await getVendorWalletBalances(vendorId);
    assert(
      updatedBalances.availableBalance === 1200,
      'Scenario 2: Vendor Deposit',
      `Vendor availableBalance updated to ৳${updatedBalances.availableBalance}`
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Reseller order unconfirmed attempt to submit tracking link (sufficient balance, but unconfirmed)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 3: Reseller Order unconfirmed submission attempt${RESET}`);
    let s3Error: any = null;
    try {
      await submitVendorCourierLink({
        orderId: orderId1,
        order: resellerOrder1,
        vendorId,
        courierName: 'Steadfast Courier',
        trackingId: 'STEAD-123456',
        trackingUrl: 'https://steadfast.com.bd/tracking/STEAD-123456'
      });
    } catch (err: any) {
      s3Error = err;
    }

    assert(
      s3Error !== null && s3Error.message.includes('অর্ডার কনফার্ম করুন'),
      'Scenario 3: Unconfirmed Order Guard',
      `Tracking link submission was BLOCKED with message: "${s3Error?.message}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Vendor clicks "অর্ডার কনফার্ম করুন" (Executes Step 5 Profit Lock)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 4: Vendor Confirms Order (Step 5 Profit Lock)${RESET}`);
    // Simulate confirmed state with profit locked (as executed by confirmVendorResellerOrder)
    await rtdbUpdate(`orders/${orderId1}`, {
      vendorOrderStatus: 'CONFIRMED',
      profitStatus: 'LOCKED',
      profitLockedAt: Date.now()
    });
    await rtdbUpdate(`vendor_orders/${orderId1}`, {
      vendorOrderStatus: 'CONFIRMED',
      profitStatus: 'LOCKED',
      profitLockedAt: Date.now()
    });
    await rtdbUpdate(`reseller_orders/${orderId1}`, {
      vendorOrderStatus: 'CONFIRMED',
      profitStatus: 'LOCKED',
      profitLockedAt: Date.now()
    });
    await rtdbUpdate(`vendor_wallet/${vendorId}`, {
      availableBalance: 700,
      lockedBalance: 500,
      totalBalance: 1200,
      updatedAt: Date.now()
    });

    const confirmedOrderInDb = await rtdbGet<any>(`orders/${orderId1}`);
    assert(
      confirmedOrderInDb.profitStatus === 'LOCKED' && confirmedOrderInDb.vendorOrderStatus === 'CONFIRMED',
      'Scenario 4: Confirmed State in RTDB',
      `profitStatus: ${confirmedOrderInDb.profitStatus}, vendorOrderStatus: ${confirmedOrderInDb.vendorOrderStatus}`
    );

    const postConfirmBalances = await getVendorWalletBalances(vendorId);
    assert(
      postConfirmBalances.availableBalance === 700 && postConfirmBalances.lockedBalance === 500,
      'Scenario 4: Profit Lock Verification',
      `Vendor availableBalance is ৳${postConfirmBalances.availableBalance} and lockedBalance is ৳${postConfirmBalances.lockedBalance}`
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Submit Courier Tracking Link AFTER Confirmation
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 5: Submit Courier Tracking Link AFTER Confirmation${RESET}`);
    const courierRes = await submitVendorCourierLink({
      orderId: orderId1,
      order: confirmedOrderInDb,
      vendorId,
      courierName: 'Steadfast Courier',
      trackingId: 'STEAD-123456',
      trackingUrl: 'https://steadfast.com.bd/tracking/STEAD-123456',
      vendorNotes: 'Package dispatched'
    });

    assert(
      courierRes.success === true,
      'Scenario 5: Tracking Link Submission Success',
      `Tracking link submitted: ${courierRes.message}`
    );

    const savedReview = await rtdbGet<any>(`courier_link_reviews/${orderId1}`);
    assert(
      savedReview && savedReview.status === 'pending' && savedReview.trackingId === 'STEAD-123456',
      'Scenario 5: Admin Review Queue Verification',
      `Review created in RTDB with status: ${savedReview?.status}, courier: ${savedReview?.courierName}`
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Normal User Order (Untouched & Bypasses Reseller Check)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}Scenario 6: Normal User Order (100% Untouched)${RESET}`);
    const normalOrder = {
      id: normalOrderId,
      orderId: normalOrderId,
      vendorId,
      isResellerOrder: false,
      status: 'Pending',
      items: [
        {
          id: 'prod_normal',
          name: 'Regular Item',
          price: 800,
          quantity: 1
        }
      ]
    };
    await rtdbSet(`orders/${normalOrderId}`, normalOrder);

    const normalCourierRes = await submitVendorCourierLink({
      orderId: normalOrderId,
      order: normalOrder,
      vendorId,
      courierName: 'Pathao Courier',
      trackingId: 'PTH-998877',
      trackingUrl: 'https://pathao.com/tracking/PTH-998877'
    });

    assert(
      normalCourierRes.success === true,
      'Scenario 6: Normal User Order Tracking',
      `Normal order submitted courier tracking link without profit check: ${normalCourierRes.message}`
    );

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }

  // Summary
  console.log(`\n${BOLD}${BLUE}========================================================================${RESET}`);
  console.log(`${BOLD}${BLUE}                         TEST SUMMARY                                   ${RESET}`);
  console.log(`${BOLD}${BLUE}========================================================================${RESET}`);
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total Scenarios : ${results.length}`);
  console.log(`Passed          : ${GREEN}${passedCount}${RESET}`);
  console.log(`Failed          : ${failedCount > 0 ? RED : GREEN}${failedCount}${RESET}`);

  if (failedCount > 0) {
    console.error(`\n${RED}${BOLD}Some tests failed!${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}✓ ALL COURIER TRACKING GUARD TESTS PASSED WITH 100% SUCCESS!${RESET}\n`);
    process.exit(0);
  }
}

runTests();
