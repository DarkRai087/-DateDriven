/**
 * Simple in-memory cache with TTL support.
 * For production, replace with Redis.
 */

class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  /**
   * Get a cached value.
   * @param {string} key
   * @returns {*} cached value or undefined
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  /**
   * Set a cached value with TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, value, ttlSeconds = 300) {
    this.delete(key);
    
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
    
    const timer = setTimeout(() => this.delete(key), ttlSeconds * 1000);
    this.timers.set(key, timer);
  }

  /**
   * Delete a cached entry.
   * @param {string} key
   */
  delete(key) {
    this.store.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Check if key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Get cache stats for monitoring.
   */
  stats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.store.clear();
    this.timers.clear();
  }
}

const cache = new MemoryCache();

/**
 * Cache-through helper: returns cached value or fetches and caches.
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if not cached
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @returns {Promise<*>}
 */
async function cacheThrough(key, fetchFn, ttlSeconds = 300) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const data = await fetchFn();
  cache.set(key, data, ttlSeconds);
  return data;
}

module.exports = { cache, cacheThrough };
