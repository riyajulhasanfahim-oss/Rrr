import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  limit, 
  where,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { rtdbGet, rtdbSet } from './rtdb';

// Initial Banners Data
export const INITIAL_BANNERS = [
  {
    id: 'banner-1',
    title: 'Summer Mega Sale',
    subtitle: 'Up to 50% off on all premium items. Discover the latest collections now.',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=2070',
    ctaText: 'Shop Now',
    ctaLink: '/category/all',
    align: 'left',
    active: true,
    order: 1
  },
  {
    id: 'banner-2',
    title: 'New Gadget Arrivals',
    subtitle: 'Upgrade your tech today with cutting-edge electronics and accessories.',
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=2070',
    ctaText: 'Discover Tech',
    ctaLink: '/category/electronics',
    align: 'right',
    active: true,
    order: 2
  },
  {
    id: 'banner-3',
    title: 'Exclusive Fashion Collection',
    subtitle: 'Trending styles for the modern wardrobe. Find your perfect fit with RJ WORLD BD.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2070',
    ctaText: 'Explore Fashion',
    ctaLink: '/category/fashion',
    align: 'center',
    active: true,
    order: 3
  }
];

// Initial Categories Data (15 Main Categories)
export const INITIAL_CATEGORIES = [
  { id: 'electronics', name: 'Electronics', path: 'electronics', iconName: 'Monitor', color: 'bg-sky-100 text-sky-600', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=300&h=300', order: 1 },
  { id: 'fashion', name: 'Fashion', path: 'fashion', iconName: 'ShoppingBag', color: 'bg-pink-100 text-pink-600', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=300&h=300', order: 2 },
  { id: 'beauty-personal-care', name: 'Beauty & Personal Care', path: 'beauty-personal-care', iconName: 'Sparkles', color: 'bg-rose-100 text-rose-600', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=300&h=300', order: 3 },
  { id: 'home-living', name: 'Home & Living', path: 'home-living', iconName: 'Home', color: 'bg-orange-100 text-orange-600', imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=300&h=300', order: 4 },
  { id: 'grocery-food', name: 'Grocery & Food', path: 'grocery-food', iconName: 'ShoppingCart', color: 'bg-green-100 text-green-600', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300&h=300', order: 5 },
  { id: 'health-wellness', name: 'Health & Wellness', path: 'health-wellness', iconName: 'Heart', color: 'bg-emerald-100 text-emerald-600', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=300&h=300', order: 6 },
  { id: 'baby-kids', name: 'Baby & Kids', path: 'baby-kids', iconName: 'Baby', color: 'bg-teal-100 text-teal-600', imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&q=80&w=300&h=300', order: 7 },
  { id: 'sports-outdoor', name: 'Sports & Outdoor', path: 'sports-outdoor', iconName: 'Dumbbell', color: 'bg-red-100 text-red-600', imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=300&h=300', order: 8 },
  { id: 'automotive-motorbike', name: 'Automotive & Motorbike', path: 'automotive-motorbike', iconName: 'Car', color: 'bg-slate-100 text-slate-700', imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=300&h=300', order: 9 },
  { id: 'books-stationery', name: 'Books & Stationery', path: 'books-stationery', iconName: 'BookOpen', color: 'bg-amber-100 text-amber-600', imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=300&h=300', order: 10 },
  { id: 'computer-gaming', name: 'Computer & Gaming', path: 'computer-gaming', iconName: 'Gamepad2', color: 'bg-indigo-100 text-indigo-600', imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=300&h=300', order: 11 },
  { id: 'jewelry-accessories', name: 'Jewelry & Accessories', path: 'jewelry-accessories', iconName: 'Gem', color: 'bg-yellow-100 text-yellow-600', imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=300&h=300', order: 12 },
  { id: 'agriculture-gardening', name: 'Agriculture & Gardening', path: 'agriculture-gardening', iconName: 'Flower2', color: 'bg-lime-100 text-lime-600', imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=300&h=300', order: 13 },
  { id: 'pet-supplies', name: 'Pet Supplies', path: 'pet-supplies', iconName: 'PawPrint', color: 'bg-cyan-100 text-cyan-600', imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=300&h=300', order: 14 },
  { id: 'others', name: 'Others', path: 'others', iconName: 'MoreHorizontal', color: 'bg-neutral-100 text-neutral-600', imageUrl: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&q=80&w=300&h=300', order: 15 }
];

// Initial Brands Data
export const INITIAL_BRANDS = [
  { id: 'brand-apple', name: 'Apple', logo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=200', verified: true },
  { id: 'brand-samsung', name: 'Samsung', logo: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=200', verified: true },
  { id: 'brand-sony', name: 'Sony', logo: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=200', verified: true },
  { id: 'brand-nike', name: 'Nike', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200', verified: true },
  { id: 'brand-adidas', name: 'Adidas', logo: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&q=80&w=200', verified: true }
];

// Initial Products Data (Demo products removed)
export const INITIAL_PRODUCTS: any[] = [];

// Initial Coupons Data
export const INITIAL_COUPONS = [
  { id: 'RJWELCOME10', code: 'RJWELCOME10', discountPercent: 10, title: 'Welcome Discount', minSpend: 20, active: true },
  { id: 'MEGA25', code: 'MEGA25', discountPercent: 25, title: 'Mega Sale Voucher', minSpend: 100, active: true },
  { id: 'FREESHIP', code: 'FREESHIP', discountFixed: 15, title: 'Free Express Shipping', minSpend: 50, active: true }
];

// Initial Platform Settings
export const INITIAL_SETTINGS = {
  platformName: 'RJ WORLD BD',
  supportEmail: 'support@rjworldbd.com',
  supportPhone: '+880 1700-000000',
  currency: 'BDT',
  currencySymbol: '৳',
  deliveryFee: 60,
  freeDeliveryThreshold: 1000,
  resellerCommissionRate: 15,
  vendorCommissionRate: 80,
  mlmLevels: 5
};

// Initial Couriers
export const INITIAL_COURIERS = [
  { id: 'courier-steadfast', name: 'Steadfast Courier', deliveryDays: '1-3 Days', rate: 60, active: true },
  { id: 'courier-pathao', name: 'Pathao Courier', deliveryDays: '1-2 Days', rate: 80, active: true },
  { id: 'courier-redx', name: 'RedX Delivery', deliveryDays: '2-4 Days', rate: 70, active: true },
  { id: 'courier-sundarban', name: 'Sundarban Courier', deliveryDays: '2-3 Days', rate: 65, active: true }
];

// Initial Ranks
export const INITIAL_RANKS = [
  { id: 'rank-1', name: 'Bronze Member', level: 1, minSales: 1000, bonus: 50, badge: '🥉' },
  { id: 'rank-2', name: 'Silver Executive', level: 2, minSales: 5000, bonus: 250, badge: '🥈' },
  { id: 'rank-3', name: 'Gold Leader', level: 3, minSales: 15000, bonus: 750, badge: '🥇' },
  { id: 'rank-4', name: 'Diamond Director', level: 4, minSales: 50000, bonus: 2500, badge: '💎' },
  { id: 'rank-5', name: 'Crown Ambassador', level: 5, minSales: 150000, bonus: 10000, badge: '👑' }
];

// Initial Vendors Data (Demo vendors removed)
export const INITIAL_VENDORS: any[] = [];

// Initial Vendor Profiles
export const INITIAL_VENDOR_PROFILES: any[] = [];

// Initial Vendor Themes
export const INITIAL_VENDOR_THEMES: any[] = [];

// Initial Vendor Wallets
export const INITIAL_VENDOR_WALLETS: any[] = [];

// Initial Resellers Data
export const INITIAL_RESELLERS = [
  {
    id: 'reseller-premier',
    userId: 'reseller-premier',
    fullName: 'RJ Premier Reseller',
    name: 'RJ Premier Reseller',
    shopName: 'Elite Reseller Shop',
    email: 'reseller@rjworldbd.com',
    mobileNumber: '+880 1799-887766',
    address: 'Dhanmondi, Dhaka',
    facebookProfile: 'https://facebook.com/rjresellershop',
    status: 'active',
    tier: 'Gold',
    commissionRate: 15,
    referralCode: 'RJPRO10',
    wallet: 8450,
    totalSales: 62000,
    totalOrders: 38,
    totalCommission: 9300,
    createdAt: Date.now()
  }
];

// Initial Reseller Wallets
export const INITIAL_RESELLER_WALLETS = [
  {
    id: 'reseller-premier',
    resellerId: 'reseller-premier',
    availableBalance: 8450,
    walletBalance: 8450,
    pendingBalance: 1200,
    pendingCommission: 1200,
    approvedCommission: 8450,
    lifetimeCommission: 9300,
    totalCommission: 9300,
    totalSales: 62000,
    totalOrders: 38,
    totalWithdrawn: 850,
    updatedAt: Date.now()
  }
];

// Initial Stores Data (Demo stores removed)
export const INITIAL_STORES: any[] = [];

// Initial Orders Data
export const INITIAL_ORDERS = [
  {
    id: 'ORD-SAMPLE-1001',
    orderId: 'ORD-SAMPLE-1001',
    userId: 'admin-frofficialbd1',
    customerId: 'admin-frofficialbd1',
    vendorId: 'vendor-tech-pro',
    vendorIds: ['vendor-tech-pro'],
    resellerId: 'reseller-premier',
    referralId: 'reseller-premier',
    items: [
      {
        id: 'prod-1',
        productId: 'prod-1',
        name: 'Sony WH-1000XM5 Noise Cancelling Wireless Headphones',
        price: 299.99,
        quantity: 1,
        vendorId: 'vendor-tech-pro',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000'
      }
    ],
    itemsCount: 1,
    subtotal: 299.99,
    total: 359.99,
    totalAmount: 359.99,
    shippingCharge: 60,
    deliveryCharge: 60,
    status: 'Delivered',
    paymentMethod: 'bKash',
    paymentStatus: 'Paid',
    transactionId: 'TRX-SAMPLE-9901',
    shippingAddress: {
      name: 'Super Admin',
      mobile: '+8801700000000',
      phone: '+8801700000000',
      email: 'frofficialbd1@gmail.com',
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
      city: 'Dhaka'
    },
    resellerCommission: 45,
    createdAt: Date.now() - (86400000 * 2),
    updatedAt: Date.now() - (86400000 * 1)
  }
];

// Initial Order Items
export const INITIAL_ORDER_ITEMS = [
  {
    id: 'ITEM-1001-1',
    orderId: 'ORD-SAMPLE-1001',
    productId: 'prod-1',
    name: 'Sony WH-1000XM5 Noise Cancelling Wireless Headphones',
    price: 299.99,
    quantity: 1,
    vendorId: 'vendor-tech-pro',
    resellerId: 'reseller-premier',
    createdAt: Date.now() - (86400000 * 2)
  }
];

// Initial Vendor Orders (Demo vendor orders removed)
export const INITIAL_VENDOR_ORDERS: any[] = [];

// Initial Reseller Orders
export const INITIAL_RESELLER_ORDERS = [
  {
    id: 'RO-1001-premier',
    orderId: 'ORD-SAMPLE-1001',
    mainOrderId: 'ORD-SAMPLE-1001',
    resellerId: 'reseller-premier',
    customerId: 'admin-frofficialbd1',
    customerName: 'Super Admin',
    customerPhone: '+8801700000000',
    customerEmail: 'frofficialbd1@gmail.com',
    items: [
      {
        id: 'prod-1',
        productId: 'prod-1',
        name: 'Sony WH-1000XM5 Noise Cancelling Wireless Headphones',
        price: 299.99,
        quantity: 1
      }
    ],
    itemsCount: 1,
    subtotal: 299.99,
    grandTotal: 359.99,
    commissionAmount: 45,
    commissionStatus: 'Approved',
    status: 'Delivered',
    paymentMethod: 'bKash',
    paymentStatus: 'Paid',
    createdAt: Date.now() - (86400000 * 2),
    updatedAt: Date.now() - (86400000 * 1)
  }
];

// Initial Reseller Transactions
export const INITIAL_RESELLER_TRANSACTIONS = [
  {
    id: 'TX-RES-001',
    resellerId: 'reseller-premier',
    orderId: 'ORD-SAMPLE-1001',
    customerName: 'Super Admin',
    productName: 'Sony WH-1000XM5 Noise Cancelling Wireless Headphones',
    amount: 45,
    status: 'Approved',
    isReferral: true,
    createdAt: Date.now() - (86400000 * 2)
  }
];

// Initial Commission Rules
export const INITIAL_COMMISSION_RULES = [
  { id: 'direct_1', type: 'direct', name: 'Direct Referral Commission', isActive: true, percentage: 10 },
  { id: 'level_1', type: 'level', name: 'Level 1 Commission', isActive: true, level: 1, percentage: 10 },
  { id: 'level_2', type: 'level', name: 'Level 2 Commission', isActive: true, level: 2, percentage: 5 },
  { id: 'level_3', type: 'level', name: 'Level 3 Commission', isActive: true, level: 3, percentage: 3 },
  { id: 'level_4', type: 'level', name: 'Level 4 Commission', isActive: true, level: 4, percentage: 2 },
  { id: 'level_5', type: 'level', name: 'Level 5 Commission', isActive: true, level: 5, percentage: 1 },
  { id: 'vendor_1', type: 'vendor', name: 'Vendor Commission', isActive: true, percentage: 80 },
  { id: 'reseller_1', type: 'reseller', name: 'Reseller Commission', isActive: true, percentage: 15 }
];

// Initial Bonus Rules
export const INITIAL_BONUS_RULES = [
  { id: 'bonus-bronze', type: 'rank_achievement', name: 'Bronze Rank Bonus', isActive: true, amount: 50 },
  { id: 'bonus-silver', type: 'rank_achievement', name: 'Silver Executive Bonus', isActive: true, amount: 250 },
  { id: 'bonus-gold', type: 'rank_achievement', name: 'Gold Leader Bonus', isActive: true, amount: 750 },
  { id: 'bonus-diamond', type: 'rank_achievement', name: 'Diamond Director Bonus', isActive: true, amount: 2500 },
  { id: 'bonus-crown', type: 'rank_achievement', name: 'Crown Ambassador Bonus', isActive: true, amount: 10000 }
];

// Initial Referral & Promo Codes
export const INITIAL_REFERRAL_CODES = [
  { id: 'RJPRO10', code: 'RJPRO10', ownerId: 'reseller-premier', discountPercent: 5, commissionPercent: 10, active: true },
  { id: 'WELCOME50', code: 'WELCOME50', ownerId: 'system', discountPercent: 10, commissionPercent: 5, active: true },
  { id: 'LEADER100', code: 'LEADER100', ownerId: 'system', discountPercent: 15, commissionPercent: 12, active: true }
];

export const INITIAL_PROMO_CODES = [
  { id: 'PROMO-SAVE10', code: 'SAVE10', resellerId: 'reseller-premier', discountPercent: 10, minPurchase: 500, active: true }
];

// Initial Admin Users
export const INITIAL_ADMIN_USERS = [
  {
    id: 'admin-frofficialbd1',
    uid: 'admin-frofficialbd1',
    email: 'frofficialbd1@gmail.com',
    name: 'Super Admin',
    role: 'Admin',
    status: 'Active',
    verified: true,
    wallet: 50000,
    createdAt: Date.now()
  },
  {
    id: 'admin-riyajulhasanfahim',
    uid: 'admin-riyajulhasanfahim',
    email: 'riyajulhasanfahim@gmail.com',
    name: 'Riyajul Hasan Fahim',
    role: 'Admin',
    status: 'Active',
    verified: true,
    wallet: 50000,
    createdAt: Date.now()
  }
];

// Initial Payments
export const INITIAL_PAYMENTS = [
  {
    id: 'PAY-INIT-001',
    paymentId: 'PAY-INIT-001',
    invoiceId: 'INV-2026-001',
    userId: 'guest',
    userType: 'customer',
    paymentMethod: 'bkash',
    expectedAmount: 1450,
    receivedAmount: 1450,
    transactionId: 'TRX9A8B7C6D',
    senderNumber: '01712345678',
    status: 'verified',
    verifiedAt: Date.now(),
    createdAt: Date.now()
  }
];

// Initial Storage Accounts
export const INITIAL_STORAGE_ACCOUNTS = [
  {
    id: 'gdrive-main',
    provider: 'google_drive',
    accountName: 'RJ World Drive Storage',
    email: 'frofficialbd1@gmail.com',
    status: 'ready',
    totalSpaceGB: 100,
    usedSpaceGB: 2.4,
    createdAt: Date.now()
  }
];

// Initial Verified Seller Requests
export const INITIAL_VERIFIED_SELLER_REQUESTS = [
  {
    id: 'req-tech-pro',
    vendorId: 'vendor-tech-pro',
    shopName: 'AudioTech Official',
    tradeLicense: 'TRAD/DNCC/012948/2022',
    nidNumber: '19892691234567890',
    status: 'approved',
    submittedAt: Date.now() - 86400000 * 30,
    approvedAt: Date.now() - 86400000 * 28
  }
];

// Extended Settings
export const INITIAL_SETTINGS_EXTENDED = {
  vendor: {
    registrationEnabled: true,
    autoApproveVendor: false,
    autoApproveProduct: false,
    orderingEnabled: true,
    settlementDays: 3,
    vendorCommissionRate: 80
  },
  reseller: {
    systemEnabled: true,
    registrationEnabled: true,
    pricingEnabled: true,
    orderingEnabled: true,
    defaultCommissionRate: 15,
    minWithdrawalAmount: 100
  },
  payment: {
    codEnabled: true,
    sofolxEnabled: true,
    sofolxBrandKey: 'Dqvx0qo2gzssXuMv9XOgez6LnaRylmvhQLVT9BV4DLVuERH2DK',
    sofolxDeviceKey: 'bl5mF3yx6kh7d8dBmW7qcJgQzcsFAo4LyVQG5E7A',
    sofolxDeviceName: 'nexg n6',
    sofolxBaseUrl: 'https://pay.sofolx.com',
    sofolxSandboxMode: false,
    bkashMerchant: '01700000000',
    nagadMerchant: '01700000000',
    rocketMerchant: '01700000000'
  }
};

/**
 * Ensures Firestore has initial seed documents for RJ WORLD BD across ALL collections.
 * Runs once safely if collections are empty.
 */
let isSeeded = false;

export async function seedAllCollections(force: boolean = false): Promise<{ success: boolean; seeded: string[]; failed: string[] }> {
  const seeded: string[] = [];
  const failed: string[] = [];

  const safeSeed = async (colName: string, items: { id: string; [key: string]: any }[]) => {
    try {
      // 1. Seed to RTDB
      for (const item of items) {
        try {
          if (!force) {
            const existing = await rtdbGet(`${colName}/${item.id}`);
            if (existing) continue;
          }
          await rtdbSet(`${colName}/${item.id}`, item);
        } catch (_) {}
      }

      // 2. Seed to Firestore (if available, non-blocking)
      try {
        if (!force) {
          const snap = await Promise.race([
            getDocs(query(collection(db, colName), limit(1))),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
          ]);
          if (snap && !snap.empty) {
            seeded.push(`${colName} (already present)`);
            return;
          }
        }
        for (const item of items) {
          await setDoc(doc(db, colName, item.id), item, { merge: true }).catch(() => {});
        }
      } catch (fsErr: any) {
        // Non-blocking Firestore notice
      }

      seeded.push(`${colName} (${items.length} items)`);
    } catch (e: any) {
      console.warn(`Failed to seed ${colName}:`, e.message);
      failed.push(`${colName}: ${e.message}`);
    }
  };

  // 1. Core Catalog
  await safeSeed('banners', INITIAL_BANNERS);
  await safeSeed('categories', INITIAL_CATEGORIES);
  await safeSeed('brands', INITIAL_BRANDS);
  // Do not overwrite or seed dummy products - keep real vendor/marketplace products intact
  await safeSeed('coupons', INITIAL_COUPONS);
  await safeSeed('couriers', INITIAL_COURIERS);
  await safeSeed('ranks', INITIAL_RANKS);

  // 2. Settings Documents
  try {
    const settingsMap: Record<string, any> = {
      global: INITIAL_SETTINGS,
      domain: {
        primaryDomain: 'rjworldbd.com',
        websiteUrl: 'https://rjworldbd.com',
        authorizedDomain: 'rjworldbd.com',
        oauthRedirectUri: 'https://rjworldbdcom.firebaseapp.com/__/auth/handler',
        fallbackOauthRedirectUri: 'https://rjworldbd.com/__/auth/handler',
        status: 'Connected',
        lastChecked: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'System'
      },
      vendor: INITIAL_SETTINGS_EXTENDED.vendor,
      reseller: INITIAL_SETTINGS_EXTENDED.reseller,
      payment: INITIAL_SETTINGS_EXTENDED.payment
    };

    for (const [key, data] of Object.entries(settingsMap)) {
      try {
        if (!force) {
          const ex = await rtdbGet(`settings/${key}`);
          if (!ex) {
            await rtdbSet(`settings/${key}`, data);
          }
        } else {
          await rtdbSet(`settings/${key}`, data);
        }
      } catch (_) {}

      try {
        if (!force) {
          const d = await Promise.race([
            getDoc(doc(db, 'settings', key)),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
          ]);
          if (d && d.exists()) continue;
        }
        await setDoc(doc(db, 'settings', key), data, { merge: true }).catch(() => {});
      } catch (_) {}
    }
    seeded.push('settings (global, domain, vendor, reseller, payment)');
  } catch (e: any) {
    failed.push(`settings: ${e.message}`);
  }

  // 3. Vendors & Stores
  await safeSeed('vendors', INITIAL_VENDORS);
  await safeSeed('stores', INITIAL_STORES);
  await safeSeed('vendor_profiles', INITIAL_VENDOR_PROFILES);
  await safeSeed('vendor_themes', INITIAL_VENDOR_THEMES);
  await safeSeed('vendor_wallet', INITIAL_VENDOR_WALLETS);
  await safeSeed('vendor_orders', INITIAL_VENDOR_ORDERS);
  await safeSeed('verified_seller_requests', INITIAL_VERIFIED_SELLER_REQUESTS);

  // 4. Reseller & MLM
  await safeSeed('resellers', INITIAL_RESELLERS);
  await safeSeed('reseller_wallet', INITIAL_RESELLER_WALLETS);
  await safeSeed('reseller_orders', INITIAL_RESELLER_ORDERS);
  await safeSeed('reseller_transactions', INITIAL_RESELLER_TRANSACTIONS);
  await safeSeed('commission_rules', INITIAL_COMMISSION_RULES);
  await safeSeed('bonus_rules', INITIAL_BONUS_RULES);
  await safeSeed('referral_codes', INITIAL_REFERRAL_CODES);
  await safeSeed('promo_codes', INITIAL_PROMO_CODES);

  // 5. Orders & Order Items
  await safeSeed('orders', INITIAL_ORDERS);
  await safeSeed('order_items', INITIAL_ORDER_ITEMS);
  await safeSeed('orderItems', INITIAL_ORDER_ITEMS);

  // 6. Admin Users & Cloud Storage & Payments
  await safeSeed('users', INITIAL_ADMIN_USERS);
  await safeSeed('payments', INITIAL_PAYMENTS);
  await safeSeed('storage_accounts', INITIAL_STORAGE_ACCOUNTS);

  return { success: failed.length === 0, seeded, failed };
}

export async function seedFirestoreInitialData() {
  if (isSeeded) return;
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('rj_seeded_done') === 'true') {
      isSeeded = true;
      return;
    }
  } catch {}
  isSeeded = true;

  // Run in background without blocking initial application render
  setTimeout(async () => {
    try {
      await seedAllCollections(false);
      try {
        localStorage.setItem('rj_seeded_done', 'true');
      } catch {}
    } catch (e) {
      console.warn('Seed background notice:', e);
    }
  }, 3000);
}
