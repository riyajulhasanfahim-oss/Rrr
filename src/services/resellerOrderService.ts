import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList } from '../lib/rtdb';

export interface ResellerOrderItemSnapshot {
  productId: string;
  productName: string;
  vendorId: string;
  quantity: number;
  vendorPrice: number;
  resellerSellingPrice: number;
  unitProfit: number;
  customerPaidAmount: number;
  resellerProfit: number;
  image?: string;
  variant?: string;
  selectedColor?: string;
  selectedSize?: string;
}

export interface ResellerOrderRecord {
  orderId: string;
  resellerId: string;
  vendorId: string;
  productId: string;
  productName?: string;
  quantity: number;
  vendorPrice: number;
  resellerSellingPrice: number;
  unitProfit?: number;
  customerPaidAmount: number;
  resellerProfit: number;
  profitStatus: 'PENDING' | 'CANCELLED' | 'RELEASED';
  orderStatus: string;
  paymentMethod: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items?: ResellerOrderItemSnapshot[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Calculates reseller profit for a given product line item
 * Formula:
 * Reseller Profit = (Reseller Selling Price - Vendor Price) × Quantity
 * 
 * Example:
 * Vendor Price = ৳110
 * Reseller Selling Price = ৳130
 * Quantity = 1
 * Reseller Profit = ৳20
 */
export function calculateResellerLineProfit(
  vendorPrice: number,
  resellerSellingPrice: number,
  quantity: number
): {
  vendorPrice: number;
  resellerSellingPrice: number;
  quantity: number;
  unitProfit: number;
  customerPaidAmount: number;
  vendorProductAmount: number;
  resellerProfit: number;
} {
  const safeQty = Math.max(1, Number(quantity) || 1);
  const safeVP = Math.max(0, Number(vendorPrice) || 0);
  const safeSP = Math.max(safeVP, Number(resellerSellingPrice) || safeVP);
  
  const unitProfit = Number((safeSP - safeVP).toFixed(2));
  const customerPaidAmount = Number((safeSP * safeQty).toFixed(2));
  const vendorProductAmount = Number((safeVP * safeQty).toFixed(2));
  const resellerProfit = Number((unitProfit * safeQty).toFixed(2));

  return {
    vendorPrice: safeVP,
    resellerSellingPrice: safeSP,
    quantity: safeQty,
    unitProfit,
    customerPaidAmount,
    vendorProductAmount,
    resellerProfit
  };
}

/**
 * Builds price snapshot and metadata for a Reseller Order.
 * Validates prices and calculates exact profit and pending profit status.
 */
export function buildResellerPriceSnapshot(
  orderId: string,
  resellerId: string,
  items: any[],
  orderData: {
    status?: string;
    paymentMethod?: string;
    customerId?: string;
    shippingAddress?: any;
  }
): ResellerOrderRecord | null {
  if (!items || items.length === 0 || !resellerId) return null;

  const itemSnapshots: ResellerOrderItemSnapshot[] = [];
  let totalResellerProfit = 0;
  let totalCustomerPaid = 0;
  let totalQuantity = 0;

  for (const it of items) {
    const pId = it.productId || it.id || '';
    const vId = it.vendorId || it.storeId || 'admin';
    const pName = it.name || it.productName || it.title || 'Product';
    const qty = Math.max(1, Number(it.quantity) || 1);
    
    // Determine vendor price (base price set by vendor)
    const rawVendorPrice = Number(it.vendorPrice ?? it.adminPrice ?? it.price ?? 0);
    // Determine reseller selling price
    const rawSellingPrice = Number(it.resellerSellingPrice ?? it.price ?? rawVendorPrice);

    const calc = calculateResellerLineProfit(rawVendorPrice, rawSellingPrice, qty);

    totalResellerProfit += calc.resellerProfit;
    totalCustomerPaid += calc.customerPaidAmount;
    totalQuantity += qty;

    itemSnapshots.push({
      productId: pId,
      productName: pName,
      vendorId: vId,
      quantity: qty,
      vendorPrice: calc.vendorPrice,
      resellerSellingPrice: calc.resellerSellingPrice,
      unitProfit: calc.unitProfit,
      customerPaidAmount: calc.customerPaidAmount,
      resellerProfit: calc.resellerProfit,
      image: it.image || it.featuredImage || '',
      variant: it.variant || it.variantSku || '',
      selectedColor: it.selectedColor || it.color || '',
      selectedSize: it.selectedSize || it.size || ''
    });
  }

  const primaryItem = itemSnapshots[0] || {
    productId: '',
    productName: '',
    vendorId: '',
    quantity: 1,
    vendorPrice: 0,
    resellerSellingPrice: 0,
    unitProfit: 0,
    customerPaidAmount: 0,
    resellerProfit: 0
  };

  const address = orderData.shippingAddress || {};
  const fullAddress = address.fullAddress || [
    address.area,
    address.upazila,
    address.district,
    address.division
  ].filter(Boolean).join(', ');

  const now = Date.now();

  const record: ResellerOrderRecord = {
    orderId,
    resellerId,
    vendorId: primaryItem.vendorId,
    productId: primaryItem.productId,
    productName: primaryItem.productName,
    quantity: totalQuantity,
    vendorPrice: primaryItem.vendorPrice,
    resellerSellingPrice: primaryItem.resellerSellingPrice,
    unitProfit: primaryItem.unitProfit,
    customerPaidAmount: totalCustomerPaid,
    resellerProfit: totalResellerProfit,
    profitStatus: 'PENDING',
    orderStatus: orderData.status || 'Pending',
    paymentMethod: orderData.paymentMethod || 'Cash on Delivery (COD)',
    customerId: orderData.customerId || 'guest',
    customerName: address.name || 'Customer',
    customerPhone: address.mobile || address.phone || '',
    customerAddress: fullAddress,
    items: itemSnapshots,
    createdAt: now,
    updatedAt: now
  };

  return record;
}

/**
 * Persists Reseller Order into RTDB nodes.
 * Enforces deduplication using unique orderId as the document identifier.
 * NO wallet balance is deducted, locked, or transferred in this step.
 */
export async function saveResellerOrderRecord(record: ResellerOrderRecord): Promise<void> {
  if (!record || !record.orderId) return;

  try {
    // 1. Check for existing order in RTDB to prevent duplicates
    const existing = await rtdbGet<any>(`reseller_orders/${record.orderId}`);
    if (existing) {
      console.warn(`[ResellerOrderService] Record for orderId ${record.orderId} already exists in RTDB. Skipping duplicate.`);
      return;
    }

    const payload = {
      ...record,
      profitStatus: 'PENDING',
      updatedAt: Date.now()
    };

    // 2. Save to RTDB reseller_orders
    await rtdbSet(`reseller_orders/${record.orderId}`, payload);

    // 3. Save to RTDB reseller scoped orders for instant query
    if (record.resellerId) {
      await rtdbSet(`resellers/${record.resellerId}/orders/${record.orderId}`, payload);
    }
  } catch (error) {
    console.error('[ResellerOrderService] Failed to save reseller order record to RTDB:', error);
  }
}

import { cancelResellerOrder } from './resellerCancellationService';

/**
 * Transitions Reseller Order Profit and Status to CANCELLED in RTDB.
 * Seamlessly handles:
 * - Case 1: Cancel Before Vendor Confirm (Zero vendor wallet deduction)
 * - Case 2: Cancel After Vendor Confirm (Vendor Locked -> Available, Reseller Pending -> Cancelled)
 * - Enforces duplicate protection and atomic updates.
 */
export async function cancelResellerOrderPendingProfit(orderId: string, reason?: string): Promise<void> {
  if (!orderId) return;
  try {
    await cancelResellerOrder({
      orderId,
      reason: reason || 'Order Cancelled',
      cancelledBy: 'system'
    });
  } catch (err) {
    console.warn('[ResellerOrderService] cancelResellerOrder error:', err);
  }
}

/**
 * Fetches reseller orders belonging to a specific resellerId strictly from RTDB.
 * Security: Strict reseller isolation.
 */
export async function fetchResellerOrders(resellerId: string): Promise<ResellerOrderRecord[]> {
  if (!resellerId) return [];

  try {
    // 1. Direct fetch from reseller scoped orders in RTDB
    const resellerList = await rtdbList<ResellerOrderRecord>(`resellers/${resellerId}/orders`);
    if (resellerList && resellerList.length > 0) {
      const orders = resellerList.map(item => ({
        ...item.data,
        orderId: item.data.orderId || item.id
      }));
      return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // 2. Query fallback from global reseller_orders in RTDB
    const all = await rtdbList<ResellerOrderRecord>('reseller_orders', o => o.resellerId === resellerId);
    const orders = all.map(item => ({
      ...item.data,
      orderId: item.data.orderId || item.id
    }));
    return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    console.warn('[ResellerOrderService] Error fetching reseller orders from RTDB:', e);
    return [];
  }
}
