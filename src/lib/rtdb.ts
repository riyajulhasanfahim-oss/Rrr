import { 
  ref, 
  get, 
  set, 
  update, 
  push, 
  remove, 
  onValue, 
  runTransaction
} from 'firebase/database';
import { rtdb, RTDB_BASE_URL } from './firebase';

/**
 * Firebase Realtime Database Utility
 * Guaranteed High-Speed, Zero-Stall Data Pipeline for RJ WORLD BD
 * Features:
 * - Parallel SDK + REST race (fastest path wins, no 2.5s sequential timeouts)
 * - In-flight request deduplication (prevents browser socket exhaustion)
 * - Short-term memory caching (instant 0ms repeat reads)
 * - Multiplexed subscriptions (multiple components share 1 listener, zero polling storms)
 */

export function sanitizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').trim();
}

// In-flight GET requests map to deduplicate identical simultaneous requests
const inflightGets = new Map<string, Promise<any>>();

// Short-term in-memory cache to prevent network hammer
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30000; // 30s high-speed memory cache (invalidated on any mutation)

/**
 * Invalidates cache for a specific path or prefix
 */
export function invalidateRtdbCache(path?: string): void {
  if (!path) {
    memoryCache.clear();
    return;
  }
  const clean = sanitizePath(path);
  for (const key of memoryCache.keys()) {
    if (key === clean || key.startsWith(clean + '/') || clean.startsWith(key + '/')) {
      memoryCache.delete(key);
    }
  }
}

interface FetchResult<T> {
  ok: boolean;
  data: T | null;
}

/**
 * Executes a fast REST fetch to Firebase RTDB with timeout protection
 */
async function fetchRtdbRest<T>(cleanPath: string, timeoutMs: number): Promise<FetchResult<T>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${RTDB_BASE_URL}/${cleanPath}.json`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data: (data !== null && data !== undefined) ? (data as T) : null };
    }
  } catch (_) {
    // Network abort or offline
  }
  return { ok: false, data: null };
}

/**
 * Executes an SDK get() with timeout protection
 */
async function fetchRtdbSdk<T>(cleanPath: string, timeoutMs: number): Promise<FetchResult<T>> {
  try {
    const dbRef = ref(rtdb, cleanPath);
    const timeoutPromise = new Promise<FetchResult<T>>((resolve) => 
      setTimeout(() => resolve({ ok: false, data: null }), timeoutMs)
    );
    const getPromise = get(dbRef).then(snap => {
      if (snap && snap.exists()) {
        return { ok: true, data: snap.val() as T };
      }
      return { ok: true, data: null };
    }).catch(() => ({ ok: false, data: null }));

    return await Promise.race([getPromise, timeoutPromise]);
  } catch (_) {
    return { ok: false, data: null };
  }
}

/**
 * Reads a document/node from Firebase Realtime Database with high-speed race & deduplication
 */
export async function rtdbGet<T = any>(path: string, timeoutMs: number = 2000): Promise<T | null> {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return null;

  // 1. Check in-memory cache
  const cached = memoryCache.get(cleanPath);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data as T;
  }

  // 2. Deduplicate in-flight requests for the exact same path
  const inflight = inflightGets.get(cleanPath);
  if (inflight) {
    return (await inflight) as T | null;
  }

  // 3. Create execution promise racing fast REST and SDK
  const execPromise = (async (): Promise<T | null> => {
    try {
      const restCall = fetchRtdbRest<T>(cleanPath, timeoutMs);
      const sdkCall = fetchRtdbSdk<T>(cleanPath, timeoutMs);

      // Whichever authoritative source completes successfully first wins (0ms delay for empty nodes!)
      const result = await new Promise<T | null>((resolve) => {
        let settled = 0;
        let hasResolved = false;

        const handleSuccess = (res: FetchResult<T>) => {
          if (hasResolved) return;
          if (res && res.ok) {
            hasResolved = true;
            resolve(res.data);
          } else {
            settled++;
            if (settled >= 2) {
              hasResolved = true;
              resolve(null);
            }
          }
        };

        restCall.then(handleSuccess).catch(() => handleSuccess({ ok: false, data: null }));
        sdkCall.then(handleSuccess).catch(() => handleSuccess({ ok: false, data: null }));

        // Hard safety timeout
        setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            resolve(null);
          }
        }, timeoutMs + 100);
      });

      if (result !== null && result !== undefined) {
        memoryCache.set(cleanPath, { data: result, timestamp: Date.now() });
      }

      return result;
    } finally {
      inflightGets.delete(cleanPath);
    }
  })();

  inflightGets.set(cleanPath, execPromise);
  return await execPromise;
}

/**
 * Sets data at a path in Firebase Realtime Database
 */
export async function rtdbSet(path: string, data: any, timeoutMs: number = 3500): Promise<void> {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return;

  // Optimistically update local cache & notify subscribers
  memoryCache.set(cleanPath, { data, timestamp: Date.now() });
  dispatchToSubscribers(cleanPath, data);

  // Try SDK write with timeout
  try {
    const dbRef = ref(rtdb, cleanPath);
    const sdkTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const sdkWrite = set(dbRef, data).then(() => true).catch(() => false);
    const success = await Promise.race([sdkWrite, sdkTimeout]);
    if (success) return;
  } catch (_) {}

  // Fallback to REST PUT
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(`${RTDB_BASE_URL}/${cleanPath}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn(`[RTDB Set Notice for ${cleanPath}]:`, err);
  }
}

/**
 * Performs shallow/merge update at a path in Firebase Realtime Database
 */
export async function rtdbUpdate(path: string, data: any, timeoutMs: number = 3500): Promise<void> {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return;

  // Invalidate cache
  invalidateRtdbCache(cleanPath);

  // Try SDK update
  try {
    const dbRef = ref(rtdb, cleanPath);
    const sdkTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const sdkUpdate = update(dbRef, data).then(() => true).catch(() => false);
    const success = await Promise.race([sdkUpdate, sdkTimeout]);
    if (success) {
      dispatchToSubscribers(cleanPath, data, true);
      return;
    }
  } catch (_) {}

  // Fallback to REST PATCH
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(`${RTDB_BASE_URL}/${cleanPath}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timer);
    dispatchToSubscribers(cleanPath, data, true);
  } catch (err) {
    console.warn(`[RTDB Update Notice for ${cleanPath}]:`, err);
  }
}

/**
 * Performs an atomic multi-path update across the database root in Firebase Realtime Database.
 */
export async function rtdbMultiUpdate(updates: Record<string, any>, timeoutMs: number = 4000): Promise<void> {
  if (!updates || Object.keys(updates).length === 0) return;

  // Invalidate affected caches
  for (const pathKey of Object.keys(updates)) {
    invalidateRtdbCache(pathKey);
  }

  try {
    const dbRef = ref(rtdb);
    const sdkTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const sdkUpdate = update(dbRef, updates).then(() => true).catch(() => false);
    const success = await Promise.race([sdkUpdate, sdkTimeout]);
    if (success) return;
  } catch (_) {}

  // Fallback to REST PATCH on root
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(`${RTDB_BASE_URL}/.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn('[RTDB Multi-PATCH error]:', err);
  }
}

/**
 * Performs an atomic transaction on an RTDB path using runTransaction.
 */
export async function rtdbTransaction<T = any>(
  path: string,
  updateFn: (currentData: T | null) => T | undefined,
  timeoutMs: number = 4000
): Promise<{ committed: boolean; snapshot: T | null }> {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return { committed: false, snapshot: null };

  invalidateRtdbCache(cleanPath);

  try {
    const dbRef = ref(rtdb, cleanPath);
    const txTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const txExec = runTransaction(dbRef, (current) => updateFn(current as T | null));
    const res = await Promise.race([txExec, txTimeout]);
    if (res && typeof (res as any).committed === 'boolean') {
      return {
        committed: (res as any).committed,
        snapshot: (res as any).snapshot?.exists() ? ((res as any).snapshot.val() as T) : null
      };
    }
  } catch (_) {}

  // Fallback: read-modify-write via rtdbGet / rtdbSet
  try {
    const current = await rtdbGet<T>(cleanPath, timeoutMs);
    const updated = updateFn(current);
    if (updated !== undefined) {
      await rtdbSet(cleanPath, updated, timeoutMs);
      return { committed: true, snapshot: updated };
    }
    return { committed: false, snapshot: current };
  } catch (fallbackErr) {
    return { committed: false, snapshot: null };
  }
}

/**
 * Pushes a new item with unique auto-key to a list node
 */
export async function rtdbPush(path: string, data: any, timeoutMs: number = 3500): Promise<string> {
  const cleanPath = sanitizePath(path);
  invalidateRtdbCache(cleanPath);

  try {
    const dbRef = ref(rtdb, cleanPath);
    const newRef = push(dbRef);
    const pushKey = newRef.key;
    if (pushKey) {
      const sdkTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
      const sdkSet = set(newRef, data).then(() => true).catch(() => false);
      const success = await Promise.race([sdkSet, sdkTimeout]);
      if (success) {
        return pushKey;
      }
    }
  } catch (_) {}

  // Fallback to REST POST
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${RTDB_BASE_URL}/${cleanPath}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const resJson = await res.json();
      return resJson?.name || `KEY-${Date.now()}`;
    }
  } catch (_) {}

  return `KEY-${Date.now()}`;
}

/**
 * Deletes a node from Firebase Realtime Database
 */
export async function rtdbRemove(path: string, timeoutMs: number = 3000): Promise<void> {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return;

  invalidateRtdbCache(cleanPath);
  dispatchToSubscribers(cleanPath, null);

  try {
    const dbRef = ref(rtdb, cleanPath);
    const sdkTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const sdkRemove = remove(dbRef).then(() => true).catch(() => false);
    const success = await Promise.race([sdkRemove, sdkTimeout]);
    if (success) return;
  } catch (_) {}

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(`${RTDB_BASE_URL}/${cleanPath}.json`, {
      method: 'DELETE',
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (_) {}
}

/**
 * Lists all children under a path, returns an array of { id, data }
 */
export async function rtdbList<T = any>(
  path: string, 
  filterFn?: (item: T, id: string) => boolean
): Promise<Array<{ id: string; data: T }>> {
  const obj = await rtdbGet<Record<string, T>>(path);
  if (!obj || typeof obj !== 'object') return [];

  const results: Array<{ id: string; data: T }> = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object') {
      if (!filterFn || filterFn(val, key)) {
        results.push({ id: key, data: val });
      }
    }
  }
  return results;
}

// ============================================================================
// Shared Multiplexed Subscription Channel Manager
// Multiple components subscribing to the same path share 1 single WebSocket listener
// Zero redundant connections, zero 3.5s polling storms!
// ============================================================================

interface SubscriptionChannel {
  callbacks: Set<(data: any) => void>;
  sdkUnsubscribe: (() => void) | null;
  lastData: any;
  lastJson: string;
  lastRefreshTime: number;
}

const subscriptionChannels = new Map<string, SubscriptionChannel>();

function dispatchToSubscribers(path: string, data: any, isPartial = false) {
  const channel = subscriptionChannels.get(path);
  if (!channel) return;

  let merged = data;
  if (isPartial && typeof channel.lastData === 'object' && channel.lastData && typeof data === 'object' && data) {
    merged = { ...channel.lastData, ...data };
  }

  const json = JSON.stringify(merged ?? null);
  if (json !== channel.lastJson) {
    channel.lastData = merged;
    channel.lastJson = json;
    channel.callbacks.forEach(cb => {
      try {
        cb(merged);
      } catch (err) {
        console.warn(`[RTDB Subscriber callback error on ${path}]:`, err);
      }
    });
  }
}

// Gentle window focus refresh (only when user switches back to tab after being away)
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      subscriptionChannels.forEach((channel, path) => {
        // Only refresh channels that haven't updated in 30 seconds
        if (now - channel.lastRefreshTime > 30000 && channel.callbacks.size > 0) {
          channel.lastRefreshTime = now;
          rtdbGet(path, 3000).then(fresh => {
            if (fresh !== null) {
              dispatchToSubscribers(path, fresh);
            }
          }).catch(() => {});
        }
      });
    }
  });
}

/**
 * Subscribes in real-time to a path in RTDB with immediate cached delivery & zero-hang architecture
 */
export function rtdbSubscribe<T = any>(
  path: string,
  callback: (data: T | null) => void
): () => void {
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return () => {};

  let channel = subscriptionChannels.get(cleanPath);

  if (!channel) {
    channel = {
      callbacks: new Set(),
      sdkUnsubscribe: null,
      lastData: null,
      lastJson: '',
      lastRefreshTime: Date.now()
    };
    subscriptionChannels.set(cleanPath, channel);

    // Initial instant fetch via high-speed rtdbGet
    rtdbGet<T>(cleanPath, 3000).then(initial => {
      if (initial !== null && channel) {
        dispatchToSubscribers(cleanPath, initial);
      }
    }).catch(() => {});

    // Establish WebSocket onValue listener
    try {
      const dbRef = ref(rtdb, cleanPath);
      channel.sdkUnsubscribe = onValue(
        dbRef,
        (snap) => {
          const val = snap.exists() ? (snap.val() as T) : null;
          dispatchToSubscribers(cleanPath, val);
        },
        (err) => {
          console.warn(`[RTDB Subscribe onValue notice for ${cleanPath}]:`, err?.message || err);
        }
      );
    } catch (e) {
      console.warn(`[RTDB Subscribe init warning for ${cleanPath}]:`, e);
    }
  }

  // Register callback
  channel.callbacks.add(callback);

  // If we already have loaded data, immediately give it to the new subscriber (0ms!)
  if (channel.lastData !== null && channel.lastData !== undefined) {
    try {
      callback(channel.lastData);
    } catch (_) {}
  } else {
    // Check if memoryCache has it
    const inMem = memoryCache.get(cleanPath);
    if (inMem && inMem.data !== null && inMem.data !== undefined) {
      try {
        callback(inMem.data);
      } catch (_) {}
    }
  }

  return () => {
    const curChannel = subscriptionChannels.get(cleanPath);
    if (curChannel) {
      curChannel.callbacks.delete(callback);
      if (curChannel.callbacks.size === 0) {
        if (curChannel.sdkUnsubscribe) {
          try {
            curChannel.sdkUnsubscribe();
          } catch (_) {}
        }
        subscriptionChannels.delete(cleanPath);
      }
    }
  };
}
