import { Product } from '../components/ui/ProductCard';

/**
 * Normalizes text by removing punctuation, extra spaces and converting to lowercase.
 * Handles both English and Bengali script normalization.
 */
export function normalizeSearchTerm(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[,\-_./\\|'"()[\]{}?!~`@#$%^&*+=:;<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bengali transliteration / keyword synonyms for common marketplace queries
const BENGALI_SYNONYMS: Record<string, string[]> = {
  'আইফোন': ['iphone', 'apple', 'mobile', 'smartphone'],
  'ফোন': ['phone', 'mobile', 'smartphone', 'iphone'],
  'মোবাইল': ['mobile', 'phone', 'smartphone', 'iphone'],
  'টুথপেস্ট': ['toothpaste', 'whiteplus', 'enamel', 'calci', 'dental'],
  'ঘড়ি': ['watch', 'smartwatch', 'clock'],
  'ঘড়ি': ['watch', 'smartwatch', 'clock'],
  'জুতা': ['shoes', 'sneakers', 'shoe', 'footwear'],
  'জুতো': ['shoes', 'sneakers', 'shoe'],
  'ল্যাপটপ': ['laptop', 'notebook', 'macbook'],
  'টি-শার্ট': ['t-shirt', 'tshirt', 'shirt', 'clothing'],
  'হেডফোন': ['headphone', 'headphones', 'earbuds', 'headset', 'airpods'],
  'ইয়ারবাড': ['earbuds', 'airpods', 'headphone', 'earphone'],
  'মাউস': ['mouse', 'gaming mouse'],
  'কীবোর্ড': ['keyboard', 'mechanical keyboard'],
  'ব্যাগ': ['bag', 'backpack'],
  'ক্রিম': ['cream', 'lotion', 'skincare'],
  'চশমা': ['sunglasses', 'glasses']
};

/**
 * Daraz-style intelligent multi-vendor search engine.
 * Matches product title/name according to user query, plus brand, category, tags,
 * and vendor/shop name across all registered vendors.
 *
 * Scoring algorithm:
 * - Exact title match: 200
 * - Title starts with query: 150
 * - Title contains exact query phrase: 120
 * - Title contains query tokens: 40 per token
 * - All query tokens present in title: +60 bonus
 * - Brand or Category match: 50
 * - Vendor / Store name match: 40
 * - Tags match: 30
 * - Description match: 20
 */
export function matchProductsDarazStyle(products: Product[], query: string): Product[] {
  if (!products || products.length === 0) {
    return [];
  }

  if (!query || !query.trim()) {
    return products;
  }

  const cleanQuery = normalizeSearchTerm(query);
  const rawTokens = cleanQuery.split(' ').filter(Boolean);

  if (rawTokens.length === 0) {
    return products;
  }

  // Expand with synonyms
  const queryTokens = new Set<string>(rawTokens);
  for (const token of rawTokens) {
    const synonyms = BENGALI_SYNONYMS[token];
    if (synonyms) {
      synonyms.forEach(s => queryTokens.add(s));
    }
  }

  const scored: Array<{ product: Product; score: number }> = [];

  for (const product of products) {
    const title = normalizeSearchTerm(product.name || (product as any).title || (product as any).productName || '');
    const brand = normalizeSearchTerm(product.brand || '');
    const category = normalizeSearchTerm(product.category || product.categorySlug || '');
    const storeName = normalizeSearchTerm(
      product.vendor?.storeName || product.vendor?.name || ''
    );
    const tags = Array.isArray(product.tags)
      ? normalizeSearchTerm(product.tags.join(' '))
      : '';
    const desc = normalizeSearchTerm(product.description || '');

    let score = 0;

    // 1. Direct Title Matching (Highest Priority - Daraz style)
    if (title === cleanQuery) {
      score += 200;
    } else if (title.startsWith(cleanQuery)) {
      score += 150;
    } else if (title.includes(cleanQuery)) {
      score += 120;
    }

    // Check individual tokens against title
    let matchedTitleTokens = 0;
    for (const token of queryTokens) {
      if (title.includes(token)) {
        matchedTitleTokens++;
        score += 45;
      }
    }

    if (rawTokens.length > 0 && matchedTitleTokens >= rawTokens.length) {
      score += 60; // All original query words present in title
    }

    // 2. Brand match
    for (const token of queryTokens) {
      if (brand && brand.includes(token)) {
        score += 40;
      }
    }

    // 3. Category match
    for (const token of queryTokens) {
      if (category && category.includes(token)) {
        score += 30;
      }
    }

    // 4. Vendor / Store match
    for (const token of queryTokens) {
      if (storeName && storeName.includes(token)) {
        score += 35;
      }
    }

    // 5. Tags match
    for (const token of queryTokens) {
      if (tags && tags.includes(token)) {
        score += 25;
      }
    }

    // 6. Description match
    for (const token of queryTokens) {
      if (desc && desc.includes(token)) {
        score += 15;
      }
    }

    // 7. Substring fallback
    if (score === 0) {
      const combined = `${title} ${brand} ${category} ${storeName} ${tags}`;
      for (const token of queryTokens) {
        if (token.length >= 2 && combined.includes(token)) {
          score += 10;
          break;
        }
      }
    }

    if (score > 0) {
      scored.push({ product, score });
    }
  }

  // Sort by score descending, then newest first
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (b.product.createdAt || 0) - (a.product.createdAt || 0);
  });

  return scored.map(item => item.product);
}

/**
 * Searches products by uploaded image against all vendor products via server API.
 */
export async function searchProductsByImage(
  file: File,
  allVendorProducts: Product[]
): Promise<{
  matchedProducts: Product[];
  detectedItem: string;
  searchQuery: string;
  similarityScores?: Record<string, number>;
  uploadedPreview?: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;

        // Call backend Visual Similarity Search endpoint
        const response = await fetch('/api/search/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Image: base64Data,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name || '',
            vendorProducts: allVendorProducts.map(p => ({
              id: p.id,
              name: p.name || (p as any).title || '',
              category: p.category,
              brand: p.brand,
              price: p.price,
              image: p.image || (p as any).imageUrl || (p as any).featuredImage || '',
              tags: p.tags
            }))
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to search by image');
        }

        const matchedIds: string[] = Array.isArray(data.matchedProductIds) ? data.matchedProductIds : [];
        const scoreList: Array<{ id: string; similarity: number; matchPercentage: number }> =
          Array.isArray(data.matchedProductsWithScores) ? data.matchedProductsWithScores : [];
        const detectedItem: string = data.detectedItem || '';
        const suggestedQuery: string = data.searchQuerySuggestion || detectedItem || '';

        const scoresMap: Record<string, number> = {};
        for (const item of scoreList) {
          if (item && item.id) {
            scoresMap[item.id] = item.matchPercentage || Math.round((item.similarity || 0) * 100);
          }
        }

        // Collect matched products in strict order of visual similarity
        const matchedMap = new Map(allVendorProducts.map(p => [p.id, p]));
        const matchedList: Product[] = [];

        for (const id of matchedIds) {
          const prod = matchedMap.get(id);
          if (prod && !matchedList.some(m => m.id === prod.id)) {
            const enrichedProd = {
              ...prod,
              matchScore: scoresMap[id] || 85
            } as Product;
            matchedList.push(enrichedProd);
          }
        }

        resolve({
          matchedProducts: matchedList,
          detectedItem,
          searchQuery: suggestedQuery,
          similarityScores: scoresMap,
          uploadedPreview: base64Data
        });
      } catch (err) {
        console.error('Image search client error:', err);
        // Fallback: try keyword matching if file name has useful hints
        const fallbackQuery = file.name ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '';
        const fallbackMatches = fallbackQuery ? matchProductsDarazStyle(allVendorProducts, fallbackQuery) : [];
        resolve({
          matchedProducts: fallbackMatches,
          detectedItem: fallbackQuery,
          searchQuery: fallbackQuery
        });
      }
    };

    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
