/**
 * Reseller Product & Pricing Types
 * Step 2: Reseller Selling Price and Profit Calculation System
 */

export interface ResellerProduct {
  id: string; // Typically `${resellerId}_${productId}`
  resellerId: string;
  productId: string;
  vendorId?: string;
  productName?: string;
  vendorPrice: number;            // Vendor-determined base price
  resellerSellingPrice: number;   // Reseller-customized selling price
  unitProfit: number;             // resellerSellingPrice - vendorPrice
  resellerProfit: number;         // (resellerSellingPrice - vendorPrice) * quantity
  quantity?: number;
  status?: 'active' | 'inactive' | string;
  createdAt: number;
  updatedAt: number;
}

export interface ResellerPriceSnapshot {
  vendorPrice: number;
  resellerSellingPrice: number;
  unitProfit: number;
  resellerProfit: number;
  quantity: number;
  capturedAt: number;
}

export interface ResellerProfitCalculationResult {
  valid: boolean;
  error?: string;
  vendorPrice: number;
  resellerSellingPrice: number;
  unitProfit: number;
  resellerProfit: number;
  quantity: number;
}
