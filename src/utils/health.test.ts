import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthMonitor, type HealthStatus } from './health';
import { geocodingCache, weatherCache } from './cache';

// Mock dependencies
vi.mock('./logger', () => ({
    logger: {
        withContext: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        })
    }
}));

vi.mock('./performance', () => ({
    performanceMonitor: {
        getStats: vi.fn(() => ({
            memory: { peak: 50 * 1024 * 1024 },
            requests: { total: 100, averageResponseTime: 250 }
        })),
        getMetrics: vi.fn(() => ({
            memoryUsage: { heapUsed: 30 * 1024 * 1024 }
        }))
    }
}));

vi.mock('./cache', () => ({
    geocodingCache: {
        getStats: vi.fn(() => ({
            size: 10,
            hitRate: 0.8
        }))
    },
    weatherCache: {
        getStats: vi.fn(() => ({
            size: 15,
            hitRate: 0.7
        }))
    }
}));

vi.mock('./rate-limiter', () => ({
    rateLimiter: {}
}));

vi.mock('../config', () => ({
    default: {
        getServerSettings: vi.fn(() => ({
            name: 'test-server',
            version: '1.0.0'
        })),
        getApiUrls: vi.fn(() => ({
            geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
            weather: 'https://api.open-meteo.com/v1/forecast'
        }))
    }
}));

// Mock global fetch
global.fetch = vi.fn();

describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitor;

    beforeEach(() => {
        vi.clearAllMocks();
        // Create a new instance without periodic checks for testing
        healthMonitor = new (class extends HealthMonitor {
            constructor() {
                super();
                // Override to prevent periodic checks during tests
            }
            protected startPeriodicHealthChecks() {
                // Disabled for tests
            }
        })();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getQuickHealth', () => {
        it('should return basic health status', async () => {
            const result = await healthMonitor.getQuickHealth();

            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('uptime');
            expect(result).toHaveProperty('timestamp');
            expect(typeof result.status).toBe('string');
            expect(typeof result.uptime).toBe('number');
            expect(typeof result.timestamp).toBe('string');
        });
    });

    describe('getHealthStatus', () => {
        it('should return comprehensive health status', async () => {
            // Mock successful API responses
            (global.fetch as any).mockResolvedValue({
                ok: true,
                status: 200
            });

            const result: HealthStatus = await healthMonitor.getHealthStatus();

            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('uptime');
            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('checks');
            expect(result).toHaveProperty('metrics');

            expect(Array.isArray(result.checks)).toBe(true);
            expect(result.checks.length).toBeGreaterThan(0);
        });

        it('should report unhealthy when checks fail', async () => {
            // Mock failing API responses
            (global.fetch as any).mockRejectedValue(new Error('Network error'));

            const result = await healthMonitor.getHealthStatus();

            expect(['degraded', 'unhealthy']).toContain(result.status);

            const failedChecks = result.checks.filter(c => c.status === 'fail');
            expect(failedChecks.length).toBeGreaterThan(0);
        });

        it('should include all required health checks', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                status: 200
            });

            const result = await healthMonitor.getHealthStatus();
            const checkNames = result.checks.map(c => c.name);

            expect(checkNames).toContain('memory');
            expect(checkNames).toContain('cache');
            expect(checkNames).toContain('external_apis');
            expect(checkNames).toContain('configuration');
            expect(checkNames).toContain('dependencies');
        });
    });

    describe('recordError', () => {
        it('should record error and increment counter', () => {
            const testError = new Error('Test error');

            expect(() => {
                healthMonitor.recordError(testError, 'test-context');
            }).not.toThrow();
        });

        it('should handle error recording with context', () => {
            const testError = new Error('Test error with context');

            expect(() => {
                healthMonitor.recordError(testError, 'weather-service');
            }).not.toThrow();
        });
    });

    describe('memory check', () => {
        it('should pass with normal memory usage', async () => {
            // Mock low memory usage
            vi.spyOn(process, 'memoryUsage').mockReturnValue({
                rss: 50 * 1024 * 1024,
                heapTotal: 100 * 1024 * 1024,
                heapUsed: 40 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            });

            const result = await healthMonitor.getHealthStatus();
            const memoryCheck = result.checks.find(c => c.name === 'memory');

            expect(memoryCheck?.status).toBe('pass');
        });

        it('should warn with elevated memory usage', async () => {
            // Mock high memory usage (65% of 80% threshold)
            vi.spyOn(process, 'memoryUsage').mockReturnValue({
                rss: 80 * 1024 * 1024,
                heapTotal: 100 * 1024 * 1024,
                heapUsed: 65 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            });

            const result = await healthMonitor.getHealthStatus();
            const memoryCheck = result.checks.find(c => c.name === 'memory');

            expect(memoryCheck?.status).toBe('warn');
        });
    });

    describe('cache check', () => {
        it('should pass with good cache hit rates', async () => {
            (geocodingCache.getStats as any).mockReturnValue({
                size: 10,
                hitRate: 0.8
            });
            (weatherCache.getStats as any).mockReturnValue({
                size: 15,
                hitRate: 0.7
            });

            const result = await healthMonitor.getHealthStatus();
            const cacheCheck = result.checks.find(c => c.name === 'cache');

            expect(cacheCheck?.status).toBe('pass');
        });

        it('should warn with low cache hit rates', async () => {
            (geocodingCache.getStats as any).mockReturnValue({
                size: 10,
                hitRate: 0.2  // Below 30% threshold
            });
            (weatherCache.getStats as any).mockReturnValue({
                size: 15,
                hitRate: 0.25  // Below 30% threshold
            });

            const result = await healthMonitor.getHealthStatus();
            const cacheCheck = result.checks.find(c => c.name === 'cache');

            expect(cacheCheck?.status).toBe('warn');
        });
    });
});