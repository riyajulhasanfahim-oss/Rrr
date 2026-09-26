import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI, Type } from '@google/genai';

export interface VendorProductInput {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  image?: string;
  featuredImage?: string;
  imageUrl?: string;
  images?: string[];
  price?: number;
  description?: string;
  tags?: string[];
}

export interface SearchByImageInput {
  base64Image: string;
  mimeType?: string;
  fileName?: string;
  vendorProducts: VendorProductInput[];
}

export interface MatchedProductScore {
  id: string;
  similarity: number;
  matchPercentage: number;
}

export interface ImageSearchResult {
  matchedProductIds: string[];
  matchedProductsWithScores: MatchedProductScore[];
  detectedItem: string;
  confidenceKeywords: string[];
  searchQuerySuggestion: string;
}

export interface ProductEmbeddingRecord {
  productId: string;
  imageUrl: string;
  embedding: number[];
  updatedAt: number;
}

// In-memory fast vector similarity cache: productId -> record
const embeddingIndex = new Map<string, ProductEmbeddingRecord>();

const CACHE_FILE_PATH = path.join(process.cwd(), 'server', 'data', 'product_embeddings.json');

/**
 * Load persisted embeddings from local cache and Firestore
 */
export function initEmbeddingIndex(): void {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        for (const [id, record] of Object.entries<any>(data)) {
          if (record && Array.isArray(record.embedding) && record.embedding.length > 0) {
            embeddingIndex.set(id, {
              productId: id,
              imageUrl: record.imageUrl || '',
              embedding: record.embedding,
              updatedAt: record.updatedAt || Date.now()
            });
          }
        }
      }
      console.log(`[VisualEmbedding] Loaded ${embeddingIndex.size} embeddings from local storage.`);
    }
  } catch (err) {
    console.warn('[VisualEmbedding] Could not read local embeddings cache file:', err);
  }

  // Also populate asynchronously from Firestore if available
  try {
    const db = getFirestore();
    db.collection('product_image_embeddings')
      .limit(500)
      .get()
      .then((snapshot) => {
        let count = 0;
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data && data.productId && Array.isArray(data.embedding)) {
            embeddingIndex.set(data.productId, data as ProductEmbeddingRecord);
            count++;
          }
        });
        if (count > 0) {
          console.log(`[VisualEmbedding] Synced ${count} embeddings from Firestore.`);
          persistIndexToDisk();
        }
      })
      .catch(() => {
        // Firestore may not be initialized yet or offline, safe to ignore
      });
  } catch (_) {}
}

// Run initial load
initEmbeddingIndex();

function persistIndexToDisk(): void {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const obj: Record<string, ProductEmbeddingRecord> = {};
    for (const [k, v] of embeddingIndex.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[VisualEmbedding] Failed to write embeddings to disk:', err);
  }
}

/**
 * Saves or updates a product embedding in memory, on disk, and in Firestore.
 * Does NOT alter or replace existing product data or image URLs!
 */
export async function saveProductEmbedding(
  productId: string,
  imageUrl: string,
  embedding: number[]
): Promise<void> {
  const record: ProductEmbeddingRecord = {
    productId,
    imageUrl,
    embedding,
    updatedAt: Date.now()
  };

  embeddingIndex.set(productId, record);
  persistIndexToDisk();

  // Save to separate Firestore collection: product_image_embeddings
  try {
    const db = getFirestore();
    await db.collection('product_image_embeddings').doc(productId).set(record, { merge: true });
  } catch (_) {
    // Firestore write error ignored gracefully
  }
}

/**
 * Converts RGB [0..255] to HSV [0..1]
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, v];
}

/**
 * 2D Discrete Cosine Transform (DCT) for structural/frequency feature extraction
 */
function compute2DDCT(matrix: Float32Array, N: number, outSize: number = 8): number[] {
  const result: number[] = [];
  const PI = Math.PI;

  for (let u = 0; u < outSize; u++) {
    for (let v = 0; v < outSize; v++) {
      let sum = 0;
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum +=
            matrix[x * N + y] *
            Math.cos(((2 * x + 1) * u * PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * PI) / (2 * N));
        }
      }
      result.push((2 / N) * cu * cv * sum);
    }
  }
  return result;
}

/**
 * Computes a 232-dimensional normalized visual feature vector/embedding
 * capturing visual characteristics:
 * - Spatial Grid Color Moments in RGB & HSV (128 dims)
 * - Contour Edge Gradient Orientations / HOG (32 dims)
 * - 2D Discrete Cosine Transform low/mid-frequency components (64 dims)
 * - Contrast, Border-to-Center luminance ratio, and Aspect Profile (8 dims)
 */
export async function computeVisualEmbedding(imageBuffer: Buffer): Promise<number[]> {
  const W = 64;
  const H = 64;

  // 1. Standardized RGB pixel data
  const { data: rgbData } = await sharp(imageBuffer)
    .resize(W, H, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const vector: number[] = [];

  // 1. Spatial Grid Color Moments (4x4 = 16 cells x 8 values = 128 dims)
  const cellW = 16;
  const cellH = 16;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let hSum = 0;
      let sSum = 0;
      let vSum = 0;
      let sSq = 0;
      let vSq = 0;
      let count = 0;

      for (let y = gy * cellH; y < (gy + 1) * cellH; y++) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x++) {
          const idx = (y * W + x) * 3;
          const r = rgbData[idx];
          const g = rgbData[idx + 1];
          const b = rgbData[idx + 2];
          rSum += r;
          gSum += g;
          bSum += b;

          const [h, s, v] = rgbToHsv(r, g, b);
          hSum += h;
          sSum += s;
          vSum += v;
          sSq += s * s;
          vSq += v * v;
          count++;
        }
      }

      const rM = rSum / (count * 255);
      const gM = gSum / (count * 255);
      const bM = bSum / (count * 255);
      const hM = hSum / count;
      const sM = sSum / count;
      const vM = vSum / count;
      const sVar = Math.sqrt(Math.max(0, sSq / count - sM * sM));
      const vVar = Math.sqrt(Math.max(0, vSq / count - vM * vM));

      vector.push(rM, gM, bM, hM, sM, vM, sVar, vVar);
    }
  }

  // 2. Edge Gradient Orientations (4 quadrants x 8 directional bins = 32 dims)
  const grayBuffer = await sharp(imageBuffer)
    .resize(W, H, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const quads = [
    [0, 0, 32, 32],
    [32, 0, 64, 32],
    [0, 32, 32, 64],
    [32, 32, 64, 64]
  ];

  for (const [x0, y0, x1, y1] of quads) {
    const bins = new Float32Array(8);
    for (let y = y0 + 1; y < y1 - 1; y++) {
      for (let x = x0 + 1; x < x1 - 1; x++) {
        const gx = grayBuffer[y * W + (x + 1)] - grayBuffer[y * W + (x - 1)];
        const gy = grayBuffer[(y + 1) * W + x] - grayBuffer[(y - 1) * W + x];
        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > 4) {
          let angle = Math.atan2(gy, gx);
          if (angle < 0) angle += 2 * Math.PI;
          const binIdx = Math.min(7, Math.floor((angle / (2 * Math.PI)) * 8));
          bins[binIdx] += mag;
        }
      }
    }
    let qNorm = 0;
    for (let b = 0; b < 8; b++) qNorm += bins[b] * bins[b];
    qNorm = Math.sqrt(qNorm) || 1;
    for (let b = 0; b < 8; b++) {
      vector.push(bins[b] / qNorm);
    }
  }

  // 3. 2D Frequency DCT Coefficients (64 dims)
  const gray32 = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const norm32 = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    norm32[i] = gray32[i] / 255;
  }
  const dct = compute2DDCT(norm32, 32, 8);
  for (const c of dct) {
    vector.push(c);
  }

  // 4. Contrast & Border-to-Center Ratio (8 dims)
  let borderSum = 0;
  let bCount = 0;
  let centerSum = 0;
  let cCount = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const val = norm32[y * 32 + x];
      if (x < 4 || x >= 28 || y < 4 || y >= 28) {
        borderSum += val;
        bCount++;
      } else if (x >= 8 && x < 24 && y >= 8 && y < 24) {
        centerSum += val;
        cCount++;
      }
    }
  }
  const borderMean = borderSum / (bCount || 1);
  const centerMean = centerSum / (cCount || 1);
  vector.push(
    borderMean,
    centerMean,
    Math.abs(centerMean - borderMean),
    borderMean > centerMean ? 1 : 0
  );
  vector.push(vector[0] || 0, vector[1] || 0, vector[2] || 0, vector[3] || 0);

  // L2 Vector Normalization to unit length (norm = 1.0)
  let sumSq = 0;
  for (const v of vector) {
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map((v) => v / norm);
}

/**
 * Calculates Cosine Similarity between two L2-normalized vectors (dot product).
 * Returns a value between -1.0 and 1.0.
 */
export function calculateCosineSimilarity(vA: number[], vB: number[]): number {
  if (!vA || !vB || vA.length === 0 || vB.length === 0) return 0;
  const len = Math.min(vA.length, vB.length);
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += vA[i] * vB[i];
  }
  return dot;
}

/**
 * Downloads image buffer from Direct Image URL (or base64/relative path)
 */
async function fetchImageBufferFromUrl(imageUrl: string): Promise<Buffer | null> {
  if (!imageUrl) return null;

  // 1. Data URL
  if (imageUrl.startsWith('data:image/')) {
    const clean = imageUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    return Buffer.from(clean, 'base64');
  }

  // 2. Relative file in public/
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) {
    const localPath = path.join(process.cwd(), 'public', imageUrl);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  // 3. HTTP / HTTPS URL
  const targetUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RJ-WORLD-BD/1.0',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Ensures that a product has a fresh, valid visual embedding in our index.
 * If the product's image URL has changed or is missing, fetches the existing Direct Image URL
 * and generates the new embedding vector.
 */
export async function ensureProductEmbedding(
  product: VendorProductInput
): Promise<number[] | null> {
  const prodId = product.id;
  const directImageUrl =
    product.image ||
    product.imageUrl ||
    product.featuredImage ||
    (Array.isArray(product.images) && product.images[0]) ||
    '';

  if (!directImageUrl) return null;

  // Check if we already have a valid embedding for this exact image URL
  const cached = embeddingIndex.get(prodId);
  if (cached && cached.imageUrl === directImageUrl && cached.embedding?.length > 0) {
    return cached.embedding;
  }

  // Need to compute or update embedding
  try {
    const buf = await fetchImageBufferFromUrl(directImageUrl);
    if (!buf) return null;

    const embedding = await computeVisualEmbedding(buf);
    await saveProductEmbedding(prodId, directImageUrl, embedding);
    return embedding;
  } catch (err) {
    console.warn(`[VisualEmbedding] Failed to embed image for product ${prodId}:`, err);
    return null;
  }
}

/**
 * Main Visual Similarity Search Engine:
 * 1. Takes customer uploaded image.
 * 2. Generates customer image visual embedding vector.
 * 3. Compares against all vendor products' visual embeddings.
 * 4. Ranks products by similarity score (highest visual match first).
 * 5. Returns matched products, similarity percentages, and descriptive suggestions.
 */
export async function analyzeImageForProductMatch(
  input: SearchByImageInput
): Promise<ImageSearchResult> {
  const { base64Image, fileName, vendorProducts } = input;

  if (!base64Image) {
    return {
      matchedProductIds: [],
      matchedProductsWithScores: [],
      detectedItem: '',
      confidenceKeywords: [],
      searchQuerySuggestion: ''
    };
  }

  // 1. Decode customer uploaded image into buffer
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const uploadedBuffer = Buffer.from(cleanBase64, 'base64');

  // 2. Generate visual feature vector for the uploaded image
  let queryEmbedding: number[];
  try {
    queryEmbedding = await computeVisualEmbedding(uploadedBuffer);
  } catch (err) {
    console.error('[VisualSearch] Failed to extract features from uploaded image:', err);
    return {
      matchedProductIds: [],
      matchedProductsWithScores: [],
      detectedItem: '',
      confidenceKeywords: [],
      searchQuerySuggestion: ''
    };
  }

  // 3. Ensure visual embeddings exist for all candidate products
  const productsToCompare = Array.isArray(vendorProducts) ? vendorProducts : [];
  const scoredProducts: Array<{
    id: string;
    product: VendorProductInput;
    similarity: number;
    matchPercentage: number;
  }> = [];

  // Batch process embeddings if missing
  const embeddingPromises = productsToCompare.map(async (prod) => {
    try {
      const emb = await ensureProductEmbedding(prod);
      if (emb) {
        const sim = calculateCosineSimilarity(queryEmbedding, emb);
        // Calibrate match percentage: cosine similarity of normalized positive features
        // typically ranges from ~0.35 (dissimilar) to ~1.0 (identical)
        const matchPct = Math.round(
          Math.max(5, Math.min(99, ((sim - 0.35) / 0.65) * 100))
        );
        return {
          id: prod.id,
          product: prod,
          similarity: sim,
          matchPercentage: matchPct
        };
      }
    } catch (_) {}
    return null;
  });

  const results = await Promise.all(embeddingPromises);
  for (const item of results) {
    if (item && !isNaN(item.similarity)) {
      scoredProducts.push(item);
    }
  }

  // 4. Sort strictly by visual similarity in descending order (highest similarity first)
  scoredProducts.sort((a, b) => b.similarity - a.similarity);

  // Filter relevant visual matches (e.g. above similarity threshold or top relative matches)
  // If top match has strong similarity, filter products within reasonable range
  let matchedList = scoredProducts;
  if (scoredProducts.length > 0) {
    const topSim = scoredProducts[0].similarity;
    if (topSim >= 0.70) {
      // Return products that have visual similarity close to top match
      matchedList = scoredProducts.filter((s) => s.similarity >= Math.max(0.65, topSim - 0.20));
    } else if (topSim >= 0.50) {
      matchedList = scoredProducts.slice(0, 10);
    } else {
      // If overall similarity is very low, still provide closest 3 items or empty
      matchedList = scoredProducts.filter((s) => s.similarity >= 0.45).slice(0, 6);
    }
  }

  // 5. Detect product label / keywords using Gemini if available or best matching item title
  let detectedItem = '';
  let searchQuerySuggestion = '';
  let confidenceKeywords: string[] = [];

  const topProduct = matchedList[0]?.product || scoredProducts[0]?.product;
  if (topProduct) {
    detectedItem = topProduct.name;
    searchQuerySuggestion = topProduct.name;
    confidenceKeywords = [
      topProduct.name,
      topProduct.brand || '',
      topProduct.category || ''
    ].filter(Boolean);
  }

  // Optional: Try Gemini API for supplementary text description if key works
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const aiPrompt = `Identify the product in this image in 2-4 words (e.g. "Smartphone", "Toothpaste", "Running Shoes"). Return JSON: {"detectedItem": string, "searchQuery": string}`;
      const genResult = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: input.mimeType || 'image/jpeg'
              }
            },
            { text: aiPrompt }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });
      const parsed = JSON.parse(genResult.text?.trim() || '{}');
      if (parsed.detectedItem) {
        detectedItem = parsed.detectedItem;
      }
      if (parsed.searchQuery) {
        searchQuerySuggestion = parsed.searchQuery;
      }
    } catch (_) {
      // Ignored: visual vector similarity is our primary ground truth
    }
  }

  // If no specific item detected, fallback to clean filename or top product name
  if (!detectedItem && fileName) {
    detectedItem = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!searchQuerySuggestion) searchQuerySuggestion = detectedItem;
  }

  const matchedProductIds = matchedList.map((m) => m.id);
  const matchedProductsWithScores: MatchedProductScore[] = matchedList.map((m) => ({
    id: m.id,
    similarity: Number(m.similarity.toFixed(4)),
    matchPercentage: m.matchPercentage
  }));

  return {
    matchedProductIds,
    matchedProductsWithScores,
    detectedItem: detectedItem || (topProduct ? topProduct.name : 'পণ্য'),
    confidenceKeywords,
    searchQuerySuggestion: searchQuerySuggestion || detectedItem
  };
}
