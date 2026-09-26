/**
 * SEO & Schema.org Structured Data Utilities for RJ WORLD BD
 * Handles dynamic meta tags, canonical links, Open Graph, Twitter Cards,
 * and Schema.org JSON-LD Product structured data for Google Rich Results.
 */

export interface SeoProductInput {
  id: string;
  name: string;
  slug?: string;
  title?: string;
  productName?: string;
  description?: string;
  shortDescription?: string;
  image?: string;
  featuredImage?: string;
  images?: string[];
  price: number | string;
  regularPrice?: number | string;
  originalPrice?: number | string;
  salePrice?: number | string;
  inStock?: boolean;
  stock?: number;
  stockCount?: number;
  sku?: string;
  brand?: string;
  category?: string;
  vendor?: {
    name?: string;
    storeName?: string;
    id?: string;
    storeId?: string;
  };
  vendorId?: string;
  storeId?: string;
  rating?: number;
  reviews?: number;
  status?: string;
  updatedAt?: number;
  createdAt?: number;
}

/**
 * Generates an SEO-friendly URL slug from product name or existing slug.
 * Supports English and Bengali (Unicode) alphanumeric characters.
 */
export function generateProductSlug(title: string, fallbackId?: string): string {
  if (!title && fallbackId) return `product-${fallbackId}`;
  const clean = (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Keep all letters (including Bengali/Bangla), numbers, spaces, hyphens
    .replace(/[\s_]+/g, '-')           // Spaces/underscores to hyphens
    .replace(/-+/g, '-')               // Collapse multi-hyphens
    .replace(/^-+|-+$/g, '')           // Trim leading/trailing hyphens
    .slice(0, 100);

  if (!clean || clean.length < 2) {
    return fallbackId ? `product-${fallbackId}` : `product-${Date.now().toString(36)}`;
  }
  return clean;
}

/**
 * Returns the preferred SEO-friendly product link.
 * Example: /product/whiteplus-daily-enamel-repair-calci-strong-toothpaste-200g
 */
export function getProductPath(product: { slug?: string; id: string; name?: string }): string {
  if (product.slug && product.slug.trim()) {
    return `/product/${product.slug.trim()}`;
  }
  if (product.name && product.name.trim()) {
    const generated = generateProductSlug(product.name, product.id);
    return `/product/${generated}`;
  }
  return `/product/${product.id}`;
}

/**
 * Strips HTML tags and excessive whitespace for clean meta descriptions.
 */
export function cleanDescription(text?: string, maxLength = 160): string {
  if (!text) return 'RJ WORLD BD Marketplace - Best products at affordable prices with fast delivery.';
  const stripped = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength - 3) + '...';
}

/**
 * Creates Google-compliant Schema.org Product JSON-LD object.
 */
export function buildProductSchema(product: SeoProductInput, origin: string): Record<string, any> {
  const currentPrice = Number(product.price) || 0;
  const originalPrice = product.originalPrice || product.regularPrice ? Number(product.originalPrice || product.regularPrice) : undefined;
  
  // Extract clean images array
  const allImages: string[] = [];
  if (product.featuredImage && typeof product.featuredImage === 'string' && product.featuredImage.trim()) {
    allImages.push(product.featuredImage.trim());
  }
  if (product.image && typeof product.image === 'string' && product.image.trim() && !allImages.includes(product.image.trim())) {
    allImages.push(product.image.trim());
  }
  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === 'string' && img.trim() && !allImages.includes(img.trim())) {
        allImages.push(img.trim());
      }
    }
  }
  if (allImages.length === 0) {
    allImages.push(`${origin}/rj-world-logo.png`);
  }

  const productUrl = `${origin}${getProductPath(product)}`;
  const sellerName = product.vendor?.storeName || product.vendor?.name || 'RJ WORLD BD';
  const brandName = product.brand && product.brand.trim() ? product.brand.trim() : 'RJ WORLD BD';
  const isAvailable = product.inStock !== false && (product.stock === undefined || product.stock > 0);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    'name': product.name || product.title || 'Product',
    'image': allImages,
    'description': cleanDescription(product.description || product.shortDescription, 300),
    'sku': product.sku || `SKU-${product.id}`,
    'mpn': product.id,
    'brand': {
      '@type': 'Brand',
      'name': brandName
    },
    'offers': {
      '@type': 'Offer',
      'url': productUrl,
      'priceCurrency': 'BDT',
      'price': currentPrice > 0 ? currentPrice : (originalPrice || 1),
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      'seller': {
        '@type': 'Organization',
        'name': sellerName,
        'url': product.vendorId ? `${origin}/store/${product.vendorId}` : origin
      }
    }
  };

  // Add AggregateRating if reviews exist
  if (product.reviews && product.reviews > 0) {
    schema['aggregateRating'] = {
      '@type': 'AggregateRating',
      'ratingValue': product.rating ? Number(product.rating).toFixed(1) : '5.0',
      'reviewCount': product.reviews
    };
  }

  return schema;
}

/**
 * Updates client-side document head metadata (Title, Description, Canonical, OG, Twitter, JSON-LD Schema)
 */
export function updateClientSeo(product: SeoProductInput | null, isNotFound = false): void {
  if (typeof document === 'undefined') return;

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://rjworldbd.com';

  // Helper to get or create a tag
  const setMetaTag = (attributeName: string, attributeValue: string, content: string) => {
    let el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`) as HTMLMetaElement;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attributeName, attributeValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setLinkTag = (rel: string, href: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  };

  // 1. If product not found or unpublished
  if (isNotFound || !product || product.status === 'Draft' || product.status === 'Inactive' || product.status === 'Deleted') {
    document.title = 'Product Not Found | RJ WORLD BD';
    setMetaTag('name', 'robots', 'noindex, nofollow');
    setMetaTag('name', 'description', 'The requested product is not available or has been removed from RJ WORLD BD.');
    
    // Remove existing product schema
    const existingSchema = document.getElementById('rtdb-product-schema');
    if (existingSchema) existingSchema.remove();
    return;
  }

  // 2. Published Product SEO Metadata
  const productName = product.name || product.title || 'Product';
  const pageTitle = `${productName} | RJ WORLD BD`;
  const desc = cleanDescription(product.description || product.shortDescription, 160);
  const canonicalUrl = `${siteOrigin}${getProductPath(product)}`;
  const mainImage = product.featuredImage || product.image || (product.images && product.images[0]) || `${siteOrigin}/rj-world-logo.png`;

  document.title = pageTitle;

  // Standard Meta Tags
  setMetaTag('name', 'description', desc);
  setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setMetaTag('name', 'googlebot', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setLinkTag('canonical', canonicalUrl);

  // Open Graph
  setMetaTag('property', 'og:type', 'product');
  setMetaTag('property', 'og:title', pageTitle);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', canonicalUrl);
  setMetaTag('property', 'og:image', mainImage);
  setMetaTag('property', 'og:site_name', 'RJ WORLD BD');
  setMetaTag('property', 'product:price:amount', String(Number(product.price) || 0));
  setMetaTag('property', 'product:price:currency', 'BDT');
  setMetaTag('property', 'product:availability', (product.inStock !== false) ? 'in stock' : 'out of stock');

  // Twitter Card
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', pageTitle);
  setMetaTag('name', 'twitter:description', desc);
  setMetaTag('name', 'twitter:image', mainImage);

  // Schema.org JSON-LD Structured Data
  let scriptEl = document.getElementById('rtdb-product-schema') as HTMLScriptElement;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'rtdb-product-schema';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  const schemaObj = buildProductSchema(product, siteOrigin);
  scriptEl.textContent = JSON.stringify(schemaObj);
}

/**
 * Resets SEO to default marketplace homepage tags upon unmount or navigating away.
 */
export function resetDefaultSeo(): void {
  if (typeof document === 'undefined') return;
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://rjworldbd.com';

  document.title = 'RJ WORLD BD - E-commerce & Reseller Marketplace';
  
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', 'RJ WORLD BD - Premier E-Commerce, Reselling & Multi-Vendor Marketplace in Bangladesh');
  
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) canonicalEl.setAttribute('href', `${siteOrigin}/`);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', 'RJ WORLD BD - E-commerce & Reseller Marketplace');

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', 'RJ WORLD BD - Premier E-Commerce, Reselling & Multi-Vendor Marketplace in Bangladesh');

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('href', `${siteOrigin}/`);

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', `${siteOrigin}/og-image.png`);

  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType) ogType.setAttribute('content', 'website');

  const robots = document.querySelector('meta[name="robots"]');
  if (robots) robots.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  const schema = document.getElementById('rtdb-product-schema');
  if (schema) schema.remove();
}
