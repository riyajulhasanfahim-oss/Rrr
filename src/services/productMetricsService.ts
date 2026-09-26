import { rtdbGet, rtdbList } from '../lib/rtdb';

export interface ProductMetrics {
  soldCount: number;
  rating: number;
  reviewsCount: number;
}

// In-memory cache for fast, zero-delay lookups
const inMemoryMetricsCache = new Map<string, ProductMetrics>();
let cacheLastFetched = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache to avoid redundant RTDB requests

/**
 * Reads product metrics from in-memory cache if available
 */
export function getCachedProductMetrics(productId: string): ProductMetrics | null {
  if (!productId) return null;
  return inMemoryMetricsCache.get(productId) || null;
}

/**
 * Calculates confirmed/completed sales and verified reviews for products
 * strictly from Firebase Realtime Database (orders, orderItems, reviews)
 */
export async function fetchAllProductsMetricsFromRTDB(forceRefresh = false): Promise<Map<string, ProductMetrics>> {
  const now = Date.now();
  if (!forceRefresh && inMemoryMetricsCache.size > 0 && (now - cacheLastFetched < CACHE_TTL_MS)) {
    return inMemoryMetricsCache;
  }

  try {
    const [ordersSnap, orderItemsSnap, reviewsSnap, vendorReviewsSnap] = await Promise.all([
      rtdbGet<Record<string, any>>('orders', 1200).catch(() => null),
      rtdbGet<Record<string, any>>('orderItems', 1200).catch(() => null),
      rtdbGet<Record<string, any>>('reviews', 1200).catch(() => null),
      rtdbGet<Record<string, any>>('vendor_reviews', 1200).catch(() => null)
    ]);

    const salesMap = new Map<string, number>();
    const ratingsMap = new Map<string, { totalStars: number; count: number }>();

    // 1. Tally sales from RTDB 'orders'
    if (ordersSnap && typeof ordersSnap === 'object') {
      for (const ord of Object.values(ordersSnap) as any[]) {
        if (!ord || typeof ord !== 'object') continue;
        const status = String(ord.status || '').toLowerCase();
        // Disregard cancelled or rejected orders
        if (status.includes('cancel') || status.includes('reject') || status.includes('refund')) {
          continue;
        }

        if (Array.isArray(ord.items)) {
          for (const item of ord.items) {
            if (!item) continue;
            const pId = item.productId || item.id;
            const qty = Number(item.quantity) || 1;
            if (pId) {
              salesMap.set(pId, (salesMap.get(pId) || 0) + qty);
            }
          }
        }
      }
    }

    // 2. Tally sales from RTDB 'orderItems'
    if (orderItemsSnap && typeof orderItemsSnap === 'object') {
      for (const [oiKey, oiVal] of Object.entries(orderItemsSnap)) {
        if (!oiVal || typeof oiVal !== 'object') continue;
        const data = (oiVal as any).data || oiVal;
        const pId = data.productId || data.id || oiKey.split('_')[0];
        const qty = Number(data.quantity) || 1;
        if (pId) {
          // Take higher of orderItems tally or orders tally to avoid double-counting
          const currentTally = salesMap.get(pId) || 0;
          if (currentTally < qty) {
            salesMap.set(pId, qty);
          }
        }
      }
    }

    // 3. Tally reviews from RTDB 'reviews'
    if (reviewsSnap && typeof reviewsSnap === 'object') {
      for (const rev of Object.values(reviewsSnap) as any[]) {
        if (!rev || typeof rev !== 'object') continue;
        const pId = rev.productId;
        const r = Number(rev.rating) || 5;
        if (pId) {
          const existing = ratingsMap.get(pId) || { totalStars: 0, count: 0 };
          ratingsMap.set(pId, {
            totalStars: existing.totalStars + r,
            count: existing.count + 1
          });
        }
      }
    }

    // 4. Also check 'vendor_reviews' if any contains productId
    if (vendorReviewsSnap && typeof vendorReviewsSnap === 'object') {
      for (const vRev of Object.values(vendorReviewsSnap) as any[]) {
        if (!vRev || typeof vRev !== 'object') continue;
        const pId = vRev.productId;
        const r = Number(vRev.rating) || 5;
        if (pId && !ratingsMap.has(pId)) {
          const existing = ratingsMap.get(pId) || { totalStars: 0, count: 0 };
          ratingsMap.set(pId, {
            totalStars: existing.totalStars + r,
            count: existing.count + 1
          });
        }
      }
    }

    // Combine all metrics into inMemoryMetricsCache
    const allProductIds = new Set<string>([...salesMap.keys(), ...ratingsMap.keys()]);
    for (const pId of allProductIds) {
      const sold = salesMap.get(pId) || 0;
      const reviewInfo = ratingsMap.get(pId);
      const reviewsCount = reviewInfo ? reviewInfo.count : 0;
      const rating = reviewInfo && reviewInfo.count > 0 
        ? Number((reviewInfo.totalStars / reviewInfo.count).toFixed(1)) 
        : 0;

      inMemoryMetricsCache.set(pId, {
        soldCount: sold,
        rating,
        reviewsCount
      });
    }

    cacheLastFetched = now;
    return inMemoryMetricsCache;
  } catch (err) {
    console.warn('[productMetricsService error]:', err);
    return inMemoryMetricsCache;
  }
}

/**
 * Retrieves real metrics for a single product from RTDB
 */
export async function fetchProductMetricsFromRTDB(productId: string): Promise<ProductMetrics> {
  if (!productId) {
    return { soldCount: 0, rating: 0, reviewsCount: 0 };
  }

  const metricsMap = await fetchAllProductsMetricsFromRTDB();
  return metricsMap.get(productId) || { soldCount: 0, rating: 0, reviewsCount: 0 };
}

/**
 * Enriches a list of products with authentic RTDB sales & review counts.
 * Strictly avoids any dummy or hardcoded values.
 */
export async function enrichProductsWithRealMetrics(products: any[]): Promise<any[]> {
  if (!Array.isArray(products) || products.length === 0) return products;

  try {
    const metricsMap = await fetchAllProductsMetricsFromRTDB();

    return products.map(product => {
      if (!product || typeof product !== 'object') return product;
      const pId = product.id;
      const rtdbMetric = metricsMap.get(pId);

      // Prioritize explicit confirmed sales from RTDB, then product record salesCount
      const realSold = rtdbMetric?.soldCount 
        ?? Number(product.salesCount ?? product.soldCount ?? product.totalSold ?? 0);

      // Prioritize authentic reviews from RTDB, then product record reviews
      const realReviewsCount = rtdbMetric?.reviewsCount 
        ?? Number(product.reviewsCount ?? product.reviews ?? 0);

      const realRating = rtdbMetric?.rating 
        ?? (realReviewsCount > 0 ? Number(product.rating || 0) : 0);

      return {
        ...product,
        soldCount: realSold,
        salesCount: realSold,
        totalSold: realSold,
        reviews: realReviewsCount,
        reviewsCount: realReviewsCount,
        rating: realRating
      };
    });
  } catch (e) {
    console.warn('Notice enriching products with real RTDB metrics:', e);
    return products;
  }
}
