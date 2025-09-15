import { logger } from './logger';

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

export interface CacheConfig {
    defaultTtl: number;
    maxSize: number;
    cleanupInterval: number;
}

export class Cache<T = any> {
    private storage = new Map<string, CacheEntry<T>>();
    private logger = logger.withContext('Cache');
    private cleanupTimer?: NodeJS.Timeout;

    constructor(private config: CacheConfig) {
        // Start automatic cleanup
        this.startCleanup();
    }

    /**
     * Store data in cache
     */
    set(key: string, data: T, ttl?: number): void {
        const now = Date.now();
        const timeToLive = ttl || this.config.defaultTtl;

        // Check size limit
        if (this.storage.size >= this.config.maxSize && !this.storage.has(key)) {
            this.evictOldest();
        }

        this.storage.set(key, {
            data,
            timestamp: now,
            ttl: timeToLive
        });

        this.logger.debug('Cache entry stored', {
            key,
            ttl: timeToLive,
            size: this.storage.size
        });
    }

    /**
     * Get data from cache
     */
    get(key: string): T | null {
        const entry = this.storage.get(key);

        if (!entry) {
            this.logger.debug('Cache miss', { key });
            return null;
        }

        const now = Date.now();
        const isExpired = (now - entry.timestamp) > entry.ttl;

        if (isExpired) {
            this.storage.delete(key);
            this.logger.debug('Cache entry expired', {
                key,
                age: now - entry.timestamp,
                ttl: entry.ttl
            });
            return null;
        }

        this.logger.debug('Cache hit', {
            key,
            age: now - entry.timestamp,
            remaining: entry.ttl - (now - entry.timestamp)
        });

        return entry.data;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Delete specific entry
     */
    delete(key: string): boolean {
        const deleted = this.storage.delete(key);
        if (deleted) {
            this.logger.debug('Cache entry deleted', { key });
        }
        return deleted;
    }

    /**
     * Clear all cache
     */
    clear(): void {
        const size = this.storage.size;
        this.storage.clear();
        this.logger.info('Cache cleared', { previousSize: size });
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let totalAge = 0;

        for (const [key, entry] of this.storage.entries()) {
            const age = now - entry.timestamp;
            if (age > entry.ttl) {
                expiredCount++;
            }
            totalAge += age;
        }

        return {
            size: this.storage.size,
            maxSize: this.config.maxSize,
            expiredEntries: expiredCount,
            averageAge: this.storage.size > 0 ? totalAge / this.storage.size : 0,
            hitRate: this.calculateHitRate()
        };
    }

    /**
     * Manual cleanup of expired entries
     */
    cleanup(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.storage.entries()) {
            const isExpired = (now - entry.timestamp) > entry.ttl;
            if (isExpired) {
                this.storage.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.debug('Cache cleanup completed', {
                cleanedEntries: cleanedCount,
                remainingEntries: this.storage.size
            });
        }
    }

    /**
     * Evict oldest entry when cache is full
     */
    private evictOldest(): void {
        let oldestKey = '';
        let oldestTimestamp = Date.now();

        for (const [key, entry] of this.storage.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.storage.delete(oldestKey);
            this.logger.debug('Cache entry evicted (size limit)', {
                key: oldestKey,
                age: Date.now() - oldestTimestamp
            });
        }
    }

    /**
     * Start automatic cleanup timer
     */
    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop automatic cleanup
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }

    // Simple hit rate tracking (last 100 operations)
    private hits = 0;
    private misses = 0;
    private readonly maxStats = 100;

    private calculateHitRate(): number {
        const total = this.hits + this.misses;
        return total > 0 ? this.hits / total : 0;
    }

    // Override get to track stats
    private originalGet = this.get;
    get(key: string): T | null {
        const result = this.originalGet.call(this, key);

        if (result !== null) {
            this.hits++;
        } else {
            this.misses++;
        }

        // Keep stats bounded
        const total = this.hits + this.misses;
        if (total > this.maxStats) {
            this.hits = Math.floor(this.hits / 2);
            this.misses = Math.floor(this.misses / 2);
        }

        return result;
    }
}

// Cache configurations for different use cases
export const CACHE_CONFIGS = {
    GEOCODING: {
        defaultTtl: 24 * 60 * 60 * 1000, // 24 hours (cities don't move)
        maxSize: 1000,
        cleanupInterval: 60 * 60 * 1000 // 1 hour
    },
    WEATHER: {
        defaultTtl: 10 * 60 * 1000, // 10 minutes (weather changes)
        maxSize: 500,
        cleanupInterval: 5 * 60 * 1000 // 5 minutes
    },
    GENERAL: {
        defaultTtl: 30 * 60 * 1000, // 30 minutes
        maxSize: 100,
        cleanupInterval: 15 * 60 * 1000 // 15 minutes
    }
} as const;

// Export singleton caches
export const geocodingCache = new Cache(CACHE_CONFIGS.GEOCODING);
export const weatherCache = new Cache(CACHE_CONFIGS.WEATHER);