import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Cache } from "../../src/cache.js";

describe("Cache", () => {
  it("stores and retrieves values", () => {
    const cache = new Cache<string>();
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("returns undefined for missing keys", () => {
    const cache = new Cache<string>();
    expect(cache.get("nope")).toBeUndefined();
  });

  it("evicts oldest entry when at max size (500)", () => {
    const cache = new Cache<number>();
    // Fill to max
    for (let i = 0; i < 500; i++) {
      cache.set(`key-${i}`, i);
    }
    expect(cache.size).toBe(500);
    // Adding one more should evict key-0 (the oldest)
    cache.set("key-500", 500);
    expect(cache.size).toBe(500);
    expect(cache.get("key-0")).toBeUndefined(); // evicted
    expect(cache.get("key-500")).toBe(500); // new entry present
  });

  it("LRU: accessing a key moves it to most recently used", () => {
    const cache = new Cache<number>();
    // Fill 499 entries
    for (let i = 0; i < 499; i++) {
      cache.set(`key-${i}`, i);
    }
    // Access key-0 to move it to end
    cache.get("key-0");
    // Fill to 500 (adds key-499)
    cache.set("key-499-extra", 999);
    // key-0 was accessed so key-1 should be evicted instead
    cache.set("key-500", 500);
    expect(cache.get("key-0")).toBe(0); // key-0 survived (was recently used)
    expect(cache.get("key-1")).toBeUndefined(); // key-1 was evicted as oldest
  });

  it("expires entries after TTL", async () => {
    // We can't easily mock Date.now in this test without side effects,
    // so we test the expiry logic by setting a value and then checking
    // that the cache reports it as undefined after simulated time
    const cache = new Cache<string>();
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");

    // Simulate time passing by directly manipulating the internal map
    const internalMap = (cache as unknown as { _map: Map<string, { value: string; expiresAt: number }> })._map;
    const entry = internalMap.get("k")!;
    entry.expiresAt = Date.now() - 1; // expired

    expect(cache.get("k")).toBeUndefined();
  });

  it("getOrFetch returns cached value without calling fn twice", async () => {
    const cache = new Cache<string>();
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return "computed";
    };

    const v1 = await cache.getOrFetch("k", fn);
    const v2 = await cache.getOrFetch("k", fn);
    expect(v1).toBe("computed");
    expect(v2).toBe("computed");
    expect(callCount).toBe(1);
  });

  it("reports correct size", () => {
    const cache = new Cache<number>();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
  });
});
