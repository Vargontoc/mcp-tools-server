import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache, CACHE_CONFIGS } from './cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache(CACHE_CONFIGS.GENERAL);
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should store and retrieve data', () => {
    cache.set('test-key', 'test-value');
    expect(cache.get('test-key')).toBe('test-value');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('non-existent')).toBeNull();
  });

  it('should expire data after TTL', async () => {
    cache.set('expire-key', 'expire-value', 100); // 100ms TTL

    expect(cache.get('expire-key')).toBe('expire-value');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('expire-key')).toBeNull();
  });

  it('should handle cache size limit', () => {
    const smallCache = new Cache({ defaultTtl: 1000, maxSize: 2, cleanupInterval: 10000 });

    smallCache.set('key1', 'value1');
    smallCache.set('key2', 'value2');
    smallCache.set('key3', 'value3'); // Should evict oldest

    expect(smallCache.get('key1')).toBeNull(); // Evicted
    expect(smallCache.get('key2')).toBe('value2');
    expect(smallCache.get('key3')).toBe('value3');

    smallCache.destroy();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });

  it('should provide accurate stats', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    const stats = cache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(CACHE_CONFIGS.GENERAL.maxSize);
  });

  it('should cleanup expired entries', async () => {
    cache.set('short-lived', 'value', 50); // 50ms TTL
    cache.set('long-lived', 'value', 10000); // 10s TTL

    // Wait for first to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    cache.cleanup();

    expect(cache.get('short-lived')).toBeNull();
    expect(cache.get('long-lived')).toBe('value');
  });
});