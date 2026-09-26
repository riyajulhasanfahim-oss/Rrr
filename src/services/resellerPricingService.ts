import { 
  rtdbGet, 
  rtdbSet, 
  rtdbUpdate 
} from '../lib/rtdb';
import { 
  ResellerProduct, 
  ResellerPriceSnapshot, 
  ResellerProfitCalculationResult 
} from '../types/resellerProduct';
import { isResellerAccount } from './resellerWalletService';

/**
 * Pure calculation function for reseller profit.
 * Formula:
 * Reseller Profit = (Reseller Selling Price - Vendor Price) × Quantity
 * 
 * Rules:
 * 1. Reseller Selling Price cannot be lower than Vendor Price.
 * 2. When Reseller Selling Price equals Vendor Price, profit is 0.
 * 3. Validation error: "Reseller selling price cannot be lower than the vendor price."
 */
export function calculateResellerProfit(
  vendorPrice: number, 
  resellerSellingPrice: number,
  quantity: number = 1
): ResellerProfitCalculationResult {
  const vPrice = Math.max(0, Number(vendorPrice) || 0);
  const sPrice = Number(resellerSellingPrice);
  const safeQty = Math.max(1, Number(quantity) || 1);

  if (isNaN(sPrice) || sPrice < 0) {
    return {
      valid: false,
      error: 'Please enter a valid selling price.',
      vendorPrice: vPrice,
      resellerSellingPrice: sPrice || 0,
      unitProfit: 0,
      resellerProfit: 0,
      quantity: safeQty
    };
  }

  if (sPrice < vPrice) {
    return {
      valid: false,
      error: 'Reseller selling price cannot be lower than the vendor price.',
      vendorPrice: vPrice,
      resellerSellingPrice: sPrice,
      unitProfit: 0,
      resellerProfit: 0,
      quantity: safeQty
    };
  }

  const unitProfit = Number((sPrice - vPrice).toFixed(2));
  const profit = Number((unitProfit * safeQty).toFixed(2));

  return {
    valid: true,
    vendorPrice: vPrice,
    resellerSellingPrice: sPrice,
    unitProfit,
    resellerProfit: profit,
    quantity: safeQty
  };
}

/**
 * Extracts the official vendor price from a product record.
 * Vendor price is strictly sourced from existing vendor/product system.
 * Vendor-এর মূল Product Price হবে Vendor Price।
 */
export function getProductVendorPrice(productData: any): number {
  if (!productData) return 0;
  
  // If product explicitly defines vendorPrice
  if (productData.vendorPrice !== undefined && productData.vendorPrice !== null && Number(productData.vendorPrice) > 0) {
    return Number(productData.vendorPrice);
  }

  // If vendor specifically designated a reseller base price, use that as vendor price foundation
  if (
    productData.resellerPrice !== undefined && 
    productData.resellerPrice !== null && 
    Number(productData.resellerPrice) > 0
  ) {
    return Number(productData.resellerPrice);
  }

  // Otherwise default to the standard product selling/regular price
  return Number(productData.price) || Number(productData.regularPrice) || 0;
}

/**
 * Fetches the official product from RTDB and retrieves its vendor price.
 */
export async function fetchVendorProductPrice(productId: string): Promise<number> {
  if (!productId) return 0;
  try {
    const prodData = await rtdbGet<any>(`products/${productId}`);
    if (!prodData) return 0;
    return getProductVendorPrice(prodData);
  } catch (err) {
    console.error('[ResellerPricingService] Error fetching product vendor price from RTDB:', err);
    return 0;
  }
}

/**
 * Fetches the saved reseller product configuration from RTDB for a given reseller and product.
 * Returns null if the reseller has not set a custom price for this product yet.
 */
export async function getResellerProduct(
  resellerId: string, 
  productId: string
): Promise<ResellerProduct | null> {
  if (!resellerId || !productId) return null;
  const docId = `${resellerId}_${productId}`;
  try {
    const data = await rtdbGet<ResellerProduct>(`reseller_products/${docId}`);
    if (data) return data;

    // Fallback path check
    const altData = await rtdbGet<ResellerProduct>(`resellers/${resellerId}/products/${productId}`);
    if (altData) return altData;

    return null;
  } catch (err) {
    console.error('[ResellerPricingService] Error getting reseller product from RTDB:', err);
    return null;
  }
}

/**
 * Saves or updates a Reseller's custom selling price for a vendor product in RTDB.
 * 
 * Enforces:
 * 1. Caller MUST have role/accountType === "reseller".
 * 2. Vendor Price is read directly from official RTDB product document, NOT from client input.
 * 3. Reseller Selling Price cannot be lower than Vendor Price.
 * 4. Reseller Profit = (Reseller Selling Price - Vendor Price) × Quantity
 * 5. Uses RTDB exclusively. Zero Firestore dependencies.
 */
export async function saveOrUpdateResellerProductPrice(params: {
  resellerId: string;
  productId: string;
  resellerSellingPrice: number;
}): Promise<ResellerProduct> {
  const { resellerId, productId, resellerSellingPrice } = params;

  if (!resellerId) throw new Error('Reseller ID is required.');
  if (!productId) throw new Error('Product ID is required.');

  // 1. Authorization check: Account must be Reseller
  const isReseller = await isResellerAccount(resellerId);
  if (!isReseller) {
    throw new Error('Unauthorized: Only reseller accounts can configure reseller selling prices.');
  }

  // 2. Fetch authoritative vendor product from RTDB
  const prodData = await rtdbGet<any>(`products/${productId}`);
  if (!prodData) {
    throw new Error('Product not found in catalog.');
  }
  const vendorPrice = getProductVendorPrice(prodData);
  const vendorId = prodData.vendorId || prodData.storeId || prodData.userId || '';
  const productName = prodData.name || '';

  // 3. Validation & Profit Calculation
  const calculation = calculateResellerProfit(vendorPrice, resellerSellingPrice, 1);
  if (!calculation.valid) {
    throw new Error(calculation.error || 'Reseller selling price cannot be lower than the vendor price.');
  }

  // 4. Persistence strictly in RTDB
  const docId = `${resellerId}_${productId}`;
  const now = Date.now();

  const existing = await rtdbGet<ResellerProduct>(`reseller_products/${docId}`);
  const createdAt = existing?.createdAt || now;

  const resellerProductRecord: ResellerProduct = {
    id: docId,
    resellerId,
    productId,
    vendorId,
    productName,
    vendorPrice,
    resellerSellingPrice: calculation.resellerSellingPrice,
    unitProfit: calculation.unitProfit,
    resellerProfit: calculation.resellerProfit,
    quantity: 1,
    status: 'active',
    createdAt,
    updatedAt: now
  };

  // Save to both canonical RTDB locations
  await rtdbSet(`reseller_products/${docId}`, resellerProductRecord);
  await rtdbSet(`resellers/${resellerId}/products/${productId}`, resellerProductRecord);

  return resellerProductRecord;
}

/**
 * Creates an immutable snapshot structure for orders in RTDB to lock in the prices
 * at the exact moment of order placement.
 * Formula:
 * Reseller Profit = (Reseller Selling Price - Vendor Price) × Quantity
 */
export function createResellerPriceSnapshot(
  vendorPrice: number, 
  resellerSellingPrice: number,
  quantity: number = 1
): ResellerPriceSnapshot {
  const calc = calculateResellerProfit(vendorPrice, resellerSellingPrice, quantity);
  if (!calc.valid) {
    throw new Error(calc.error);
  }

  return {
    vendorPrice: calc.vendorPrice,
    resellerSellingPrice: calc.resellerSellingPrice,
    unitProfit: calc.unitProfit,
    resellerProfit: calc.resellerProfit,
    quantity: calc.quantity,
    capturedAt: Date.now()
  };
}
