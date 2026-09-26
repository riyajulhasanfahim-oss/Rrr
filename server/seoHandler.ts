import path from 'path';
import fs from 'fs';

interface RtdbProduct {
  id?: string;
  productId?: string;
  name?: string;
  title?: string;
  productName?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price?: number | string;
  regularPrice?: number | string;
  originalPrice?: number | string;
  salePrice?: number | string;
  image?: string;
  featuredImage?: string;
  imageUrl?: string;
  images?: string[];
  brand?: string;
  category?: string;
  sku?: string;
  inStock?: boolean;
  stock?: number;
  stockCount?: number;
  status?: string;
  vendor?: {
    name?: string;
    storeName?: string;
    id?: string;
  };
  vendorId?: string;
  storeId?: string;
  rating?: number;
  reviews?: number;
  specifications?: Record<string, string>;
  createdAt?: number;
  updatedAt?: number;
}

const RTDB_URL = 'https://rjworldbdcom-default-rtdb.firebaseio.com';

// Cache products in memory for 60 seconds to ensure high performance while staying fresh
let cachedProducts: Record<string, RtdbProduct> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function fetchProductsFromRtdb(forceRefresh = false): Promise<Record<string, RtdbProduct>> {
  const now = Date.now();
  if (!forceRefresh && cachedProducts && (now - cacheTime < CACHE_TTL_MS)) {
    return cachedProducts;
  }

  try {
    const res = await fetch(`${RTDB_URL}/products.json`);
    if (!res.ok) {
      console.warn(`[RTDB Fetch Warning] Status ${res.status}`);
      return cachedProducts || {};
    }
    const data = (await res.json()) as Record<string, RtdbProduct>;
    if (data && typeof data === 'object') {
      cachedProducts = data;
      cacheTime = now;
      return data;
    }
    return cachedProducts || {};
  } catch (err) {
    console.error('[RTDB Products Fetch Error]:', err);
    return cachedProducts || {};
  }
}

/**
 * Finds a product in RTDB by ID, slug, or productId.
 */
export async function findProductByIdOrSlug(identifier: string): Promise<{ id: string; product: RtdbProduct } | null> {
  if (!identifier) return null;
  const products = await fetchProductsFromRtdb();

  const decoded = decodeURIComponent(identifier).trim().toLowerCase();

  // 1. Direct key match in RTDB
  if (products[identifier]) {
    return { id: identifier, product: { ...products[identifier], id: identifier } };
  }

  // 2. Iterate and match slug, id, or productId
  for (const [key, item] of Object.entries(products)) {
    if (!item) continue;
    const itemSlug = (item.slug || '').trim().toLowerCase();
    const itemId = (item.id || key || '').trim().toLowerCase();
    const itemProdId = (item.productId || '').trim().toLowerCase();

    if (itemSlug === decoded || itemId === decoded || itemProdId === decoded) {
      return { id: key, product: { ...item, id: key } };
    }
  }

  return null;
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanText(str?: string, maxLen = 160): string {
  if (!str) return 'RJ WORLD BD Marketplace - Premier online shopping in Bangladesh.';
  const stripped = str
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen - 3) + '...';
}

/**
 * Generates dynamic XML sitemap with all published products from Firebase Realtime Database.
 */
export async function generateDynamicSitemap(baseUrl: string): Promise<string> {
  const productsObj = await fetchProductsFromRtdb(true);
  const nowStr = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/products`, priority: '0.8', changefreq: 'daily' },
    { loc: `${baseUrl}/brands`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/become-vendor`, priority: '0.6', changefreq: 'monthly' }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static URLs
  for (const s of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(s.loc)}</loc>\n`;
    xml += `    <lastmod>${nowStr}</lastmod>\n`;
    xml += `    <changefreq>${s.changefreq}</changefreq>\n`;
    xml += `    <priority>${s.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Published Products from RTDB
  for (const [key, prod] of Object.entries(productsObj)) {
    if (!prod) continue;
    // Strict requirement: ONLY Published/Active products
    if (prod.status && prod.status !== 'Published') {
      continue;
    }

    const slug = (prod.slug && prod.slug.trim()) ? prod.slug.trim() : key;
    const prodUrl = `${baseUrl}/product/${slug}`;
    const modDate = prod.updatedAt || prod.createdAt ? new Date(prod.updatedAt || prod.createdAt!).toISOString().split('T')[0] : nowStr;
    const prodName = prod.name || prod.title || prod.productName || 'Product';
    const mainImg = prod.featuredImage || prod.image || (prod.images && prod.images[0]);

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(prodUrl)}</loc>\n`;
    xml += `    <lastmod>${modDate}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;

    if (mainImg) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(mainImg)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(prodName)}</image:title>\n`;
      xml += `    </image:image>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}

/**
 * Generates SEO-compliant robots.txt allowing Googlebot to crawl product pages and sitemap.
 */
export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /
Allow: /product/
Allow: /category/
Allow: /products
Allow: /brands
Allow: /store/
Disallow: /admin/
Disallow: /vendor/
Disallow: /reseller/
Disallow: /checkout
Disallow: /cart
Disallow: /orders
Disallow: /my-chats
Disallow: /payment/

User-agent: Googlebot
Allow: /
Allow: /product/

User-agent: Googlebot-Image
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
}

/**
 * Pre-renders SEO metadata, Schema.org JSON-LD, and semantic HTML into index.html for search engine crawlers.
 */
export function injectProductSeo(html: string, product: RtdbProduct, baseUrl: string): string {
  const prodName = product.name || product.title || product.productName || 'Product';
  const pageTitle = `${prodName} | RJ WORLD BD`;
  const desc = cleanText(product.description || product.shortDescription, 160);
  const preferredSlug = (product.slug && product.slug.trim()) ? product.slug.trim() : (product.id || 'product');
  const canonicalUrl = `${baseUrl}/product/${preferredSlug}`;
  
  const mainImage = product.featuredImage || product.image || (product.images && product.images[0]) || `${baseUrl}/rj-world-logo.png`;
  const allImages = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : [mainImage];

  const priceNum = Number(product.price) || 0;
  const brandName = (product.brand && product.brand.trim()) ? product.brand.trim() : 'RJ WORLD BD';
  const sellerName = product.vendor?.storeName || product.vendor?.name || 'RJ WORLD BD';
  const isAvailable = product.inStock !== false && (product.stock === undefined || product.stock > 0);

  // Schema.org Product Rich Result JSON-LD
  const schemaObj = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    'name': prodName,
    'image': allImages,
    'description': cleanText(product.description || product.shortDescription, 300),
    'sku': product.sku || `SKU-${product.id || 'RJ'}`,
    'mpn': product.id || product.productId || 'UNKNOWN',
    'brand': {
      '@type': 'Brand',
      'name': brandName
    },
    'offers': {
      '@type': 'Offer',
      'url': canonicalUrl,
      'priceCurrency': 'BDT',
      'price': priceNum > 0 ? priceNum : 1,
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      'seller': {
        '@type': 'Organization',
        'name': sellerName,
        'url': product.vendorId ? `${baseUrl}/store/${product.vendorId}` : baseUrl
      }
    }
  };

  const schemaJson = JSON.stringify(schemaObj, null, 2);

  // Tags to inject in <head>
  const metaTags = `
    <!-- Dynamic Product SEO generated from Firebase Realtime Database -->
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(mainImage)}" />
    <meta property="og:site_name" content="RJ WORLD BD" />
    <meta property="product:price:amount" content="${priceNum}" />
    <meta property="product:price:currency" content="BDT" />
    <meta property="product:availability" content="${isAvailable ? 'in stock' : 'out of stock'}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImage)}" />

    <!-- Schema.org JSON-LD Structured Data for Google Rich Results -->
    <script type="application/ld+json" id="rtdb-product-schema">
${schemaJson}
    </script>
`;

  // Pre-rendered semantic HTML markup placed inside <div id="root">
  // Allows crawlers with or without JavaScript execution to read the full product data immediately.
  const preRenderedHtml = `
    <main class="seo-ssr-container" style="max-width:1200px;margin:0 auto;padding:16px;font-family:sans-serif;">
      <nav aria-label="breadcrumb" style="font-size:13px;color:#64748b;margin-bottom:16px;">
        <a href="/" style="color:#0284c7;text-decoration:none;">Home</a> / 
        <a href="/category/${encodeURIComponent(product.category || 'all')}" style="color:#0284c7;text-decoration:none;">${escapeHtml(product.category || 'Products')}</a> / 
        <span>${escapeHtml(prodName)}</span>
      </nav>

      <article itemscope itemtype="https://schema.org/Product">
        <h1 itemprop="name" style="font-size:24px;font-weight:bold;color:#0f172a;margin-bottom:12px;">${escapeHtml(prodName)}</h1>
        
        <div style="margin-bottom:16px;display:flex;align-items:baseline;gap:12px;">
          <span style="font-size:26px;font-weight:bold;color:#0284c7;" itemprop="price">৳${priceNum.toLocaleString()} BDT</span>
          ${product.originalPrice && Number(product.originalPrice) > priceNum ? `<span style="font-size:16px;color:#94a3b8;text-decoration:line-through;">৳${Number(product.originalPrice).toLocaleString()}</span>` : ''}
          <span style="font-size:13px;padding:4px 8px;border-radius:6px;background:#ecfdf5;color:#059669;font-weight:600;">
            ${isAvailable ? 'স্টক আছে (In Stock)' : 'স্টক শেষ (Out of Stock)'}
          </span>
        </div>

        <div style="margin-bottom:20px;max-width:480px;">
          <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(prodName)} - ${escapeHtml(brandName)}" itemprop="image" style="width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;" />
        </div>

        <div style="background:#f8fafc;padding:16px;border-radius:12px;margin-bottom:20px;font-size:14px;line-height:1.6;border:1px solid #e2e8f0;">
          <p><strong>Brand:</strong> <span itemprop="brand">${escapeHtml(brandName)}</span></p>
          <p><strong>Category:</strong> <span>${escapeHtml(product.category || 'General')}</span></p>
          <p><strong>Seller / Store:</strong> <a href="${product.vendorId ? `/store/${product.vendorId}` : '/'}" style="color:#0284c7;">${escapeHtml(sellerName)}</a></p>
          ${product.sku ? `<p><strong>SKU:</strong> <span>${escapeHtml(product.sku)}</span></p>` : ''}
        </div>

        <div style="font-size:15px;line-height:1.7;color:#334155;margin-top:20px;" itemprop="description">
          <h2 style="font-size:18px;font-weight:bold;color:#0f172a;margin-bottom:8px;">Product Description</h2>
          <p>${escapeHtml(product.description || desc).replace(/\n/g, '<br/>')}</p>
        </div>
      </article>
    </main>
  `;

  // Replace <title>
  let modified = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);

  // Replace or inject canonical
  if (modified.includes('<link rel="canonical"')) {
    modified = modified.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  } else {
    modified = modified.replace('</head>', `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n</head>`);
  }

  // Remove default description/OG tags to avoid duplicates
  modified = modified.replace(/<meta name="description"[^>]*>/i, '');
  modified = modified.replace(/<meta property="og:title"[^>]*>/gi, '');
  modified = modified.replace(/<meta property="og:description"[^>]*>/gi, '');
  modified = modified.replace(/<meta property="og:image"[^>]*>/gi, '');
  modified = modified.replace(/<meta property="og:url"[^>]*>/gi, '');
  modified = modified.replace(/<meta property="og:type"[^>]*>/gi, '');
  modified = modified.replace(/<meta name="twitter:title"[^>]*>/gi, '');
  modified = modified.replace(/<meta name="twitter:description"[^>]*>/gi, '');
  modified = modified.replace(/<meta name="twitter:image"[^>]*>/gi, '');

  // Inject our rich meta tags into <head>
  modified = modified.replace('</head>', `${metaTags}\n</head>`);

  // Inject pre-rendered content into <div id="root">
  modified = modified.replace(/<div id="root"><\/div>/i, `<div id="root">${preRenderedHtml}</div>`);

  return modified;
}

/**
 * Returns 404 HTML with noindex, nofollow for deleted/unpublished products.
 */
export function inject404Seo(html: string): string {
  let modified = html.replace(/<title>.*?<\/title>/i, `<title>Product Not Found | RJ WORLD BD</title>`);
  // Remove existing index robots directives
  modified = modified.replace(/<meta\s+name=["']robots["'][^>]*>/gi, '');
  modified = modified.replace(/<meta\s+name=["']googlebot["'][^>]*>/gi, '');
  
  const tags = `
    <meta name="robots" content="noindex, nofollow" />
    <meta name="googlebot" content="noindex, nofollow" />
    <meta name="description" content="The product you are looking for is unavailable or has been removed." />
  `;
  modified = modified.replace('</head>', `${tags}\n</head>`);
  modified = modified.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">
      <div style="max-width:600px;margin:80px auto;text-align:center;font-family:sans-serif;padding:24px;">
        <h1 style="font-size:32px;color:#e11d48;font-weight:bold;margin-bottom:12px;">Product Not Found</h1>
        <p style="color:#64748b;font-size:16px;margin-bottom:24px;">This product is no longer published or has been removed from RJ WORLD BD.</p>
        <a href="/" style="display:inline-block;padding:12px 24px;background:#0284c7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Back to Homepage</a>
      </div>
    </div>`
  );
  return modified;
}
