import { db } from '../db/database';
import type { NutritionFood, CachedProduct } from '../models/types';

const API_BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const SEARCH_FIELDS = [
  'product_name',
  'nutriments',
  'code',
  'quantity',
  'serving_quantity',
].join(',');

const NUTRIMENT_FIELDS = [
  'energy-kcal_100g',
  'proteins_100g',
  'fat_100g',
  'carbohydrates_100g',
  'fiber_100g',
];

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  quantity?: string;
  serving_quantity?: string;
  nutriments?: OFFNutriments;
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
}

interface OFFSearchResponse {
  products?: OFFProduct[];
  status?: number;
  status_verbose?: string;
}

interface OFFProductResponse {
  product?: OFFProduct;
  status?: number;
  status_verbose?: string;
}

const requestTimestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    throw new Error(
      `Rate limit exceeded: maximum ${RATE_LIMIT_MAX} requests per minute`,
    );
  }
  requestTimestamps.push(now);
}

function detectUnit(quantity: string | undefined): string {
  if (!quantity) return 'g';
  const lower = quantity.toLowerCase();
  if (lower.includes('l') || lower.includes('cl') || lower.includes('ml')) {
    return 'ml';
  }
  return 'g';
}

function mapProductToNutritionFood(product: OFFProduct): NutritionFood {
  const nutriments = product.nutriments ?? {};
  const unit = detectUnit(product.quantity);
  // Les nutriments peuvent être directement dans l'objet product (quand on spécifie les champs individuels)
  // ou dans un sous-objet nutriments
  const calories = nutriments['energy-kcal_100g'] ?? product['energy-kcal_100g'] ?? 0;
  const proteins = nutriments.proteins_100g ?? product.proteins_100g ?? 0;
  const lipids = nutriments.fat_100g ?? product.fat_100g ?? 0;
  const carbs = nutriments.carbohydrates_100g ?? product.carbohydrates_100g ?? 0;
  const fibers = nutriments.fiber_100g ?? product.fiber_100g ?? 0;
  return {
    name: product.product_name ?? 'Unknown product',
    quantity: 100,
    unit,
    barcode: product.code,
    calories,
    proteins,
    lipids,
    carbs,
    fibers,
  };
}

function productToCachedProduct(product: OFFProduct): CachedProduct {
  const nutriments = product.nutriments ?? {};
  return {
    barcode: product.code ?? '',
    name: product.product_name ?? 'Unknown product',
    quantity: product.quantity ?? '100g',
    servingQuantity: product.serving_quantity ?? '',
    calories: nutriments['energy-kcal_100g'] ?? product['energy-kcal_100g'] ?? 0,
    proteins: nutriments.proteins_100g ?? product.proteins_100g ?? 0,
    lipids: nutriments.fat_100g ?? product.fat_100g ?? 0,
    carbs: nutriments.carbohydrates_100g ?? product.carbohydrates_100g ?? 0,
    fibers: nutriments.fiber_100g ?? product.fiber_100g ?? 0,
    cachedAt: Date.now(),
  };
}

function cachedProductToNutritionFood(cached: CachedProduct): NutritionFood {
  const unit = detectUnit(cached.quantity);
  return {
    name: cached.name,
    quantity: 100,
    unit,
    barcode: cached.barcode,
    calories: cached.calories,
    proteins: cached.proteins,
    lipids: cached.lipids,
    carbs: cached.carbs,
    fibers: cached.fibers,
  };
}

async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      if (response.status === 429 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (error instanceof TypeError && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

async function getCachedProduct(barcode: string): Promise<CachedProduct | undefined> {
  const cached = await db.cachedProducts.get(barcode);
  if (!cached) return undefined;
  if (Date.now() - cached.cachedAt >= CACHE_TTL_MS) return undefined;
  // Ignorer le cache si les nutriments sont à 0 (données corrompues de l'ancien format)
  if (cached.calories === 0 && cached.proteins === 0 && cached.lipids === 0 && cached.carbs === 0 && cached.fibers === 0) {
    await db.cachedProducts.delete(barcode);
    return undefined;
  }
  return cached;
}

async function cacheProduct(product: OFFProduct): Promise<void> {
  if (!product.code) return;
  const cached = productToCachedProduct(product);
  await db.cachedProducts.put(cached);
}

async function cacheProducts(products: OFFProduct[]): Promise<void> {
  const cachedProducts = products
    .filter((p) => p.code)
    .map(productToCachedProduct);
  if (cachedProducts.length > 0) {
    await db.cachedProducts.bulkPut(cachedProducts);
  }
}

export async function searchProduct(query: string): Promise<NutritionFood[]> {
  if (!query.trim()) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const url = `${API_BASE_URL}/search?search_terms=${encodedQuery}&fields=${SEARCH_FIELDS},${NUTRIMENT_FIELDS.join(',')}&page_size=20&json=1`;

  checkRateLimit();

  const response = await fetchWithRetry(url);
  const data: OFFSearchResponse = await response.json();

  if (!data.products || data.products.length === 0) {
    return [];
  }

  await cacheProducts(data.products);

  return data.products.map(mapProductToNutritionFood);
}

export async function getProductByBarcode(barcode: string): Promise<NutritionFood | null> {
  if (!barcode.trim()) {
    return null;
  }

  const trimmedBarcode = barcode.trim();

  const cached = await getCachedProduct(trimmedBarcode);
  if (cached) {
    return cachedProductToNutritionFood(cached);
  }

  const url = `${API_BASE_URL}/product/${trimmedBarcode}.json?fields=${SEARCH_FIELDS},${NUTRIMENT_FIELDS.join(',')}`;

  checkRateLimit();

  const response = await fetchWithRetry(url);
  const data: OFFProductResponse = await response.json();

  if (!data.product || data.status === 0) {
    return null;
  }

  await cacheProduct(data.product);

  return mapProductToNutritionFood(data.product);
}

export function clearProductCache(): Promise<void> {
  return db.cachedProducts.clear();
}

export function getCurrentRateLimitCount(): number {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  return requestTimestamps.filter((t) => t >= windowStart).length;
}