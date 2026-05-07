// LRU dedup cache — size 500, TTL 60s
// Scoped per tool invocation: construct a new Cache() in each tool handler
// Uses Map (insertion-order) for simple LRU eviction

const MAX_SIZE = 500;
const TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache<T = unknown> {
  private readonly _map = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this._map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return undefined;
    }

    // Move to end (LRU: most recently used = last in insertion order)
    this._map.delete(key);
    this._map.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest entry when at capacity
    if (this._map.size >= MAX_SIZE && !this._map.has(key)) {
      const firstKey = this._map.keys().next().value;
      if (firstKey !== undefined) {
        this._map.delete(firstKey);
      }
    }

    this._map.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this._map.size;
  }

  /** Retrieve or compute and cache a value. */
  async getOrFetch(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    if (value !== null && value !== undefined) {
      this.set(key, value);
    }
    return value;
  }
}
