import { auth } from '../lib/firebase';
import { rtdbGet, rtdbSet, rtdbPush, rtdbList } from '../lib/rtdb';
import { Product } from '../components/ui/ProductCard';
import { INITIAL_CATEGORIES, INITIAL_BANNERS, INITIAL_COUPONS } from '../lib/firebaseSeed';
import { fetchAllMarketplaceProducts, fetchProductById, normalizeProduct, getCachedMarketplaceProducts } from './productService';
import { matchProductsDarazStyle } from '../utils/searchEngine';

// 1. PRODUCTS
export async function getFirestoreProducts(categorySlug?: string, limitCount = 100): Promise<Product[]> {
  try {
    let allProducts = getCachedMarketplaceProducts();
    if (!allProducts || allProducts.length === 0) {
      allProducts = await fetchAllMarketplaceProducts();
    }
    if (!allProducts || allProducts.length === 0) {
      return [];
    }
    if (categorySlug && categorySlug !== 'all') {
      const cleanSlug = categorySlug.toLowerCase().trim();
      return allProducts.filter(p => 
        (p.categorySlug && p.categorySlug.toLowerCase().includes(cleanSlug)) || 
        (p.category && p.category.toLowerCase().includes(cleanSlug))
      ).slice(0, limitCount);
    }
    return allProducts.slice(0, limitCount);
  } catch (error) {
    console.warn('Error getting marketplace products:', error);
    return [];
  }
}

export async function getFirestoreProductById(productId: string): Promise<any | null> {
  try {
    return await fetchProductById(productId);
  } catch (error) {
    console.warn('Error fetching product by ID:', error);
    return null;
  }
}

export async function searchFirestoreProducts(searchQuery: string): Promise<Product[]> {
  try {
    let allProducts = getCachedMarketplaceProducts();
    if (!allProducts || allProducts.length === 0) {
      allProducts = await fetchAllMarketplaceProducts();
    }
    if (!searchQuery || !searchQuery.trim()) return allProducts;

    return matchProductsDarazStyle(allProducts, searchQuery);
  } catch (error) {
    console.warn('Error searching marketplace products:', error);
    return [];
  }
}

// 2. CATEGORIES
export async function getFirestoreCategories(): Promise<any[]> {
  try {
    const list = await rtdbList<any>('categories');
    if (!list || list.length === 0) return INITIAL_CATEGORIES;
    const cats = list.map(item => ({ id: item.id, ...item.data }));
    const merged = [...INITIAL_CATEGORIES];
    cats.forEach(c => {
      const idx = merged.findIndex(m => m.id === c.id || m.name?.toLowerCase() === c.name?.toLowerCase());
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...c };
      } else {
        merged.push(c);
      }
    });
    merged.sort((a, b) => (a.order || 0) - (b.order || 0));
    return merged;
  } catch (error) {
    return INITIAL_CATEGORIES;
  }
}

// 3. BANNERS
export async function getFirestoreBanners(): Promise<any[]> {
  try {
    const list = await rtdbList<any>('banners', b => b.active === true);
    if (!list || list.length === 0) return INITIAL_BANNERS;
    return list.map(item => ({ id: item.id, ...item.data }));
  } catch (error) {
    return INITIAL_BANNERS;
  }
}

// 4. COUPONS
export async function getFirestoreCoupons(): Promise<any[]> {
  try {
    const list = await rtdbList<any>('coupons', c => c.active === true);
    if (!list || list.length === 0) return INITIAL_COUPONS;
    return list.map(item => ({ id: item.id, ...item.data }));
  } catch (error) {
    return INITIAL_COUPONS;
  }
}

// 5. RECENT VIEWS
export async function addRecentViewToFirestore(userId: string, product: Product) {
  try {
    await rtdbSet(`recentViews/${userId}_${product.id}`, {
      userId,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productImage: product.image,
      viewedAt: Date.now()
    });
  } catch (e) {
    console.warn('Could not record recent view in RTDB', e);
  }
}

// 6. SEARCH HISTORY
export async function addSearchHistoryToFirestore(userId: string, queryText: string) {
  if (!queryText.trim()) return;
  try {
    await rtdbPush('searchHistory', {
      userId,
      query: queryText.trim(),
      timestamp: Date.now()
    });
  } catch (e) {
    console.warn('Could not record search history in RTDB', e);
  }
}

// 7. SUPPORT TICKETS
export async function createSupportTicket(userId: string, subject: string, message: string, category: string) {
  try {
    const ticketId = await rtdbPush('supportTickets', {
      userId,
      userEmail: auth.currentUser?.email || '',
      subject,
      message,
      category,
      status: 'Open',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return ticketId;
  } catch (e) {
    console.error('Error creating support ticket in RTDB:', e);
    throw e;
  }
}

// 8. SHIPPING ADDRESSES
export async function getShippingAddresses(userId: string) {
  try {
    const list = await rtdbList<any>('shippingAddresses', a => a.userId === userId);
    return list.map(item => ({ id: item.id, ...item.data }));
  } catch (e) {
    console.warn('Could not get shipping addresses from RTDB', e);
    return [];
  }
}

export async function addShippingAddress(userId: string, addressData: any) {
  try {
    const id = await rtdbPush('shippingAddresses', {
      userId,
      ...addressData,
      createdAt: Date.now()
    });
    return { id };
  } catch (e) {
    console.error('Error adding shipping address to RTDB:', e);
    throw e;
  }
}

// 9. REVIEWS
export async function getProductReviews(productId: string) {
  try {
    const list = await rtdbList<any>('reviews', r => r.productId === productId);
    const reviews = list.map(item => ({ id: item.id, ...item.data }));
    reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return reviews;
  } catch (e) {
    console.warn('Could not fetch reviews from RTDB', e);
    return [];
  }
}

export async function addProductReview(productId: string, rating: number, comment: string, customerName: string) {
  try {
    const id = await rtdbPush('reviews', {
      productId,
      customerId: auth.currentUser?.uid || 'guest',
      customerName,
      rating,
      comment,
      createdAt: Date.now()
    });
    return { id };
  } catch (e) {
    console.error('Error adding review in RTDB:', e);
    throw e;
  }
}

// 10. NOTIFICATIONS
export async function getUserNotifications(userId: string) {
  try {
    const list = await rtdbList<any>('notifications', n => n.userId === userId);
    const notifs = list.map(item => ({ id: item.id, ...item.data }));
    notifs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return notifs.slice(0, 30);
  } catch (e) {
    console.warn('Could not get notifications from RTDB', e);
    return [];
  }
}
