import { logger } from './logger';
import { performanceMonitor } from './performance';
import { geocodingCache, weatherCache } from './cache';
import { rateLimiter } from './rate-limiter';
import config from '../config';

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: HealthCheck[];
    metrics: SystemMetrics;
}

export interface HealthCheck {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    duration: number;
    metadata?: Record<string, any>;
}

export interface SystemMetrics {
    memory: {
        used: number;
        total: number;
        percentage: number;
        peak: number;
    };
    cpu: {
        usage: NodeJS.CpuUsage;
        loadAverage: number[];
    };
    cache: {
        geocoding: any;
        weather: any;
    };
    requests: {
        total: number;
        averageResponseTime: number;
    };
    errors: {
        total: number;
        rate: number;
    };
}

export class HealthMonitor {
    private logger = logger.withContext('HealthMonitor');
    private startTime = Date.now();
    private errorCount = 0;
    private lastErrorTime = 0;
    private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    private alertThresholds = {
        memory: 80, // percentage
        responseTime: 5000, // ms
        errorRate: 0.1, // 10%
        diskSpace: 90 // percentage
    };

    constructor() {
        this.startPeriodicHealthChecks();
    }

    /**
     * Get comprehensive health status
     */
    async getHealthStatus(): Promise<HealthStatus> {
        const startTime = Date.now();
        const checks: HealthCheck[] = [];

        // Run all health checks
        checks.push(await this.checkMemory());
        checks.push(await this.checkCacheHealth());
        checks.push(await this.checkExternalAPIs());
        checks.push(await this.checkConfiguration());
        checks.push(await this.checkDependencies());

        // Determine overall status
        const failCount = checks.filter(c => c.status === 'fail').length;
        const warnCount = checks.filter(c => c.status === 'warn').length;

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (failCount > 0) {
            overallStatus = 'unhealthy';
        } else if (warnCount > 1) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'healthy';
        }

        const serverSettings = config.getServerSettings();
        const metrics = await this.getSystemMetrics();

        const healthStatus: HealthStatus = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: serverSettings.version,
            checks,
            metrics
        };

        // Log health status changes
        if (overallStatus !== this.healthStatus) {
            this.logger.warn('Health status changed', {
                from: this.healthStatus,
                to: overallStatus,
                checks: checks.filter(c => c.status !== 'pass')
            });
            this.healthStatus = overallStatus;
        }

        this.logger.debug('Health check completed', {
            status: overallStatus,
            duration: Date.now() - startTime,
            checks: checks.length
        });

        return healthStatus;
    }

    /**
     * Simple health check for quick status
     */
    async getQuickHealth(): Promise<{ status: string; uptime: number; timestamp: string }> {
        return {
            status: this.healthStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Record error for health tracking
     */
    recordError(error: Error, context?: string): void {
        this.errorCount++;
        this.lastErrorTime = Date.now();

        this.logger.error('Error recorded for health monitoring', error, {
            context,
            totalErrors: this.errorCount
        });

        // Trigger immediate health assessment if error rate is high
        const recentErrors = this.getRecentErrorRate();
        if (recentErrors > this.alertThresholds.errorRate) {
            this.logger.warn('High error rate detected', {
                errorRate: recentErrors,
                threshold: this.alertThresholds.errorRate
            });
        }
    }

    private async checkMemory(): Promise<HealthCheck> {
        const start = Date.now();
        const memory = process.memoryUsage();
        const memoryUsedMB = memory.heapUsed / 1024 / 1024;
        const memoryTotalMB = memory.heapTotal / 1024 / 1024;
        const memoryPercentage = (memoryUsedMB / memoryTotalMB) * 100;

        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = `Memory usage: ${memoryUsedMB.toFixed(2)}MB (${memoryPercentage.toFixed(1)}%)`;

        if (memoryPercentage > this.alertThresholds.memory) {
            status = 'fail';
            message += ' - CRITICAL: High memory usage';
        } else if (memoryPercentage > this.alertThresholds.memory * 0.8) {
            status = 'warn';
            message += ' - WARNING: Elevated memory usage';
        }

        return {
            name: 'memory',
            status,
            message,
            duration: Date.now() - start,
            metadata: {
                heapUsed: memory.heapUsed,
                heapTotal: memory.heapTotal,
                external: memory.external,
                percentage: memoryPercentage
            }
        };
    }

    private async checkCacheHealth(): Promise<HealthCheck> {
        const start = Date.now();
        const geocodingStats = geocodingCache.getStats();
        const weatherStats = weatherCache.getStats();

        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = `Cache operational - Geocoding: ${geocodingStats.size} entries, Weather: ${weatherStats.size} entries`;

        // Check cache hit rates
        const geoHitRate = geocodingStats.hitRate || 0;
        const weatherHitRate = weatherStats.hitRate || 0;

        if (geoHitRate < 0.3 || weatherHitRate < 0.3) {
            status = 'warn';
            message += ` - LOW hit rates: Geo ${(geoHitRate * 100).toFixed(1)}%, Weather ${(weatherHitRate * 100).toFixed(1)}%`;
        }

        return {
            name: 'cache',
            status,
            message,
            duration: Date.now() - start,
            metadata: {
                geocoding: geocodingStats,
                weather: weatherStats
            }
        };
    }

    private async checkExternalAPIs(): Promise<HealthCheck> {
        const start = Date.now();
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'External APIs accessible';

        try {
            const { geocoding, weather } = config.getApiUrls();

            // Quick connectivity test (HEAD request would be ideal, but these APIs might not support it)
            const testPromises = [
                fetch(`${geocoding}?name=test&count=1&format=json`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                }),
                fetch(`${weather}?latitude=0&longitude=0&current=temperature_2m`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                })
            ];

            const results = await Promise.allSettled(testPromises);
            const failures = results.filter(r => r.status === 'rejected').length;

            if (failures === 2) {
                status = 'fail';
                message = 'Both external APIs unreachable';
            } else if (failures === 1) {
                status = 'warn';
                message = 'One external API unreachable';
            }

        } catch (error) {
            status = 'warn';
            message = 'Unable to test external API connectivity';
        }

        return {
            name: 'external_apis',
            status,
            message,
            duration: Date.now() - start
        };
    }

    private async checkConfiguration(): Promise<HealthCheck> {
        const start = Date.now();
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'Configuration valid';

        try {
            const serverSettings = config.getServerSettings();
            const apiUrls = config.getApiUrls();

            // Basic validation
            if (!serverSettings.name || !serverSettings.version) {
                status = 'warn';
                message = 'Missing server configuration';
            }

            // URL validation
            new URL(apiUrls.geocoding);
            new URL(apiUrls.weather);

        } catch (error) {
            status = 'fail';
            message = 'Invalid configuration detected';
        }

        return {
            name: 'configuration',
            status,
            message,
            duration: Date.now() - start
        };
    }

    private async checkDependencies(): Promise<HealthCheck> {
        const start = Date.now();
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'All dependencies available';

        try {
            // Check critical modules
            const criticalModules = ['zod', 'dotenv'];
            const missingModules = [];

            for (const moduleName of criticalModules) {
                try {
                    require.resolve(moduleName);
                } catch {
                    missingModules.push(moduleName);
                }
            }

            if (missingModules.length > 0) {
                status = 'fail';
                message = `Missing dependencies: ${missingModules.join(', ')}`;
            }

        } catch (error) {
            status = 'warn';
            message = 'Unable to verify dependencies';
        }

        return {
            name: 'dependencies',
            status,
            message,
            duration: Date.now() - start
        };
    }

    private async getSystemMetrics(): Promise<SystemMetrics> {
        const memory = process.memoryUsage();
        const perfStats = performanceMonitor.getStats();

        return {
            memory: {
                used: memory.heapUsed,
                total: memory.heapTotal,
                percentage: (memory.heapUsed / memory.heapTotal) * 100,
                peak: perfStats.memory.peak
            },
            cpu: {
                usage: process.cpuUsage(),
                loadAverage: process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg()
            },
            cache: {
                geocoding: geocodingCache.getStats(),
                weather: weatherCache.getStats()
            },
            requests: {
                total: perfStats.requests.total,
                averageResponseTime: perfStats.requests.averageResponseTime
            },
            errors: {
                total: this.errorCount,
                rate: this.getRecentErrorRate()
            }
        };
    }

    private getRecentErrorRate(): number {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (this.lastErrorTime < fiveMinutesAgo) {
            return 0;
        }

        const perfStats = performanceMonitor.getStats();
        const totalRequests = perfStats.requests.total;

        return totalRequests > 0 ? this.errorCount / totalRequests : 0;
    }

    protected startPeriodicHealthChecks(): void {
        // Full health check every 5 minutes
        setInterval(async () => {
            try {
                const health = await this.getHealthStatus();
                if (health.status !== 'healthy') {
                    this.logger.warn('Periodic health check: System not healthy', {
                        status: health.status,
                        failedChecks: health.checks.filter(c => c.status !== 'pass')
                    });
                }
            } catch (error) {
                this.logger.error('Error during periodic health check', error);
            }
        }, 5 * 60 * 1000);

        this.logger.info('Periodic health monitoring started');
    }
}

export const healthMonitor = new HealthMonitor();