interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttlSeconds: number;
}

/**
 * TTLCacheManager
 * Ensures system reliability by caching responses with TTL and storing failover fallbacks.
 * System never crashes even if external APIs (OSM, Google, Open-Meteo) timeout or fail.
 */
export class TTLCacheManager {
  private static cache: Map<string, CacheItem<any>> = new Map();
  private static failoverSnapshot: Map<string, any> = new Map();

  public static set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttlSeconds,
    };
    this.cache.set(key, item);
    // Persist as latest permanent fallback
    this.failoverSnapshot.set(key, data);
  }

  public static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }
    const ageSeconds = (Date.now() - item.timestamp) / 1000;
    if (ageSeconds > item.ttlSeconds) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }

  public static getFailover<T>(key: string): T | null {
    if (this.failoverSnapshot.has(key)) {
      return this.failoverSnapshot.get(key) as T;
    }
    return null;
  }

  public static clear(): void {
    this.cache.clear();
  }
}
