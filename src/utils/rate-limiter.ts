import { logger } from './logger';

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    identifier?: string;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private logger = logger.withContext('RateLimiter');

    /**
     * Check if request is within rate limit
     */
    checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Get existing requests for this key
        const requestTimes = this.requests.get(key) || [];

        // Remove expired requests (outside the window)
        const validRequests = requestTimes.filter(time => time > windowStart);

        // Check if limit exceeded
        if (validRequests.length >= config.maxRequests) {
            const oldestRequest = Math.min(...validRequests);
            const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);

            this.logger.warn('Rate limit exceeded', {
                key,
                requests: validRequests.length,
                maxRequests: config.maxRequests,
                windowMs: config.windowMs,
                retryAfter
            });

            return {
                allowed: false,
                remaining: 0,
                resetTime: oldestRequest + config.windowMs,
                retryAfter
            };
        }

        // Add current request
        validRequests.push(now);
        this.requests.set(key, validRequests);

        const remaining = config.maxRequests - validRequests.length;
        const resetTime = validRequests[0] + config.windowMs;

        this.logger.debug('Rate limit check passed', {
            key,
            requests: validRequests.length,
            remaining,
            resetTime
        });

        return {
            allowed: true,
            remaining,
            resetTime
        };
    }

    /**
     * Clean up expired entries (memory management)
     */
    cleanup(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, requestTimes] of this.requests.entries()) {
            const validRequests = requestTimes.filter(time => time > now - 300000); // Keep last 5 minutes

            if (validRequests.length === 0) {
                this.requests.delete(key);
                cleanedCount++;
            } else if (validRequests.length < requestTimes.length) {
                this.requests.set(key, validRequests);
            }
        }

        if (cleanedCount > 0) {
            this.logger.debug('Rate limiter cleanup completed', {
                cleanedEntries: cleanedCount,
                activeKeys: this.requests.size
            });
        }
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            activeKeys: this.requests.size,
            totalTrackedRequests: Array.from(this.requests.values())
                .reduce((sum, requests) => sum + requests.length, 0)
        };
    }

    /**
     * Reset rate limit for a specific key (for testing/admin)
     */
    reset(key: string): void {
        this.requests.delete(key);
        this.logger.info('Rate limit reset', { key });
    }

    /**
     * Reset all rate limits
     */
    resetAll(): void {
        const keysCount = this.requests.size;
        this.requests.clear();
        this.logger.info('All rate limits reset', { previousKeys: keysCount });
    }
}

export const rateLimiter = new RateLimiter();

// Automatic cleanup every 5 minutes
setInterval(() => {
    rateLimiter.cleanup();
}, 5 * 60 * 1000);

// Default configurations for different services
export const RATE_LIMITS = {
    WEATHER_API: {
        maxRequests: 30,     // 30 requests
        windowMs: 60 * 1000, // per minute
        identifier: 'weather'
    },
    GEOCODING_API: {
        maxRequests: 20,     // 20 requests
        windowMs: 60 * 1000, // per minute
        identifier: 'geocoding'
    },
    TOOL_USAGE: {
        maxRequests: 10,     // 10 weather tool calls
        windowMs: 60 * 1000, // per minute
        identifier: 'tool'
    }
} as const;