import { logger } from './logger';

export interface PerformanceMetrics {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage: number[];
    cpuUsage: NodeJS.CpuUsage;
    gcStats?: {
        collections: number;
        totalTime: number;
    };
}

export class PerformanceMonitor {
    private logger = logger.withContext('PerformanceMonitor');
    private startTime = Date.now();
    private requestCount = 0;
    private responseTimeSum = 0;
    private cpuStart = process.cpuUsage();
    private memoryPeak = 0;

    constructor() {
        this.setupMemoryMonitoring();
    }

    /**
     * Track request performance
     */
    trackRequest<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        const startCpu = process.cpuUsage();

        return fn().then(
            (result) => {
                this.recordMetrics(operation, startTime, startCpu, 'success');
                return result;
            },
            (error) => {
                this.recordMetrics(operation, startTime, startCpu, 'error');
                throw error;
            }
        );
    }

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        const memory = process.memoryUsage();

        return {
            memoryUsage: memory,
            uptime: process.uptime(),
            loadAverage: process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg(),
            cpuUsage: process.cpuUsage(this.cpuStart)
        };
    }

    /**
     * Get aggregated stats
     */
    getStats() {
        return {
            requests: {
                total: this.requestCount,
                averageResponseTime: this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0
            },
            memory: {
                current: process.memoryUsage(),
                peak: this.memoryPeak
            },
            uptime: {
                process: process.uptime(),
                application: (Date.now() - this.startTime) / 1000
            }
        };
    }

    /**
     * Create a performance timer
     */
    createTimer(operation: string) {
        const start = process.hrtime.bigint();
        const startMemory = process.memoryUsage().heapUsed;

        return {
            end: () => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1e6; // Convert to milliseconds
                const endMemory = process.memoryUsage().heapUsed;
                const memoryDelta = endMemory - startMemory;

                this.logger.debug('Operation completed', {
                    operation,
                    duration: `${duration.toFixed(2)}ms`,
                    memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
                });

                return { duration, memoryDelta };
            }
        };
    }

    /**
     * Force garbage collection if available
     */
    forceGC(): boolean {
        if (global.gc) {
            const before = process.memoryUsage();
            global.gc();
            const after = process.memoryUsage();

            const freed = before.heapUsed - after.heapUsed;
            this.logger.debug('Manual GC completed', {
                freed: `${(freed / 1024 / 1024).toFixed(2)}MB`,
                heapUsed: `${(after.heapUsed / 1024 / 1024).toFixed(2)}MB`
            });

            return true;
        }
        return false;
    }

    private recordMetrics(operation: string, startTime: number, startCpu: NodeJS.CpuUsage, status: string) {
        const duration = Date.now() - startTime;
        const cpuUsage = process.cpuUsage(startCpu);

        this.requestCount++;
        this.responseTimeSum += duration;

        this.logger.debug('Request completed', {
            operation,
            duration: `${duration}ms`,
            status,
            cpuTime: `${(cpuUsage.user + cpuUsage.system) / 1000}ms`
        });
    }

    private setupMemoryMonitoring() {
        const checkMemory = () => {
            const usage = process.memoryUsage();

            if (usage.heapUsed > this.memoryPeak) {
                this.memoryPeak = usage.heapUsed;
            }

            // Warn if memory usage is high
            const heapUsedMB = usage.heapUsed / 1024 / 1024;
            if (heapUsedMB > 100) { // More than 100MB
                this.logger.warn('High memory usage detected', {
                    heapUsed: `${heapUsedMB.toFixed(2)}MB`,
                    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
                    external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`
                });
            }
        };

        // Check memory every 30 seconds
        setInterval(checkMemory, 30000);
    }
}

/**
 * Lazy module loader to reduce initial bundle size
 */
export class LazyLoader {
    private modules = new Map<string, any>();
    private logger = logger.withContext('LazyLoader');

    async load<T = any>(moduleName: string, importFn: () => Promise<any>): Promise<T> {
        if (this.modules.has(moduleName)) {
            this.logger.debug('Module cache hit', { module: moduleName });
            return this.modules.get(moduleName);
        }

        this.logger.debug('Loading module lazily', { module: moduleName });
        const timer = performanceMonitor.createTimer(`load-module-${moduleName}`);

        try {
            const module = await importFn();
            this.modules.set(moduleName, module);
            timer.end();

            this.logger.info('Module loaded successfully', {
                module: moduleName,
                cacheSize: this.modules.size
            });

            return module;
        } catch (error) {
            timer.end();
            this.logger.error('Failed to load module', error, { module: moduleName });
            throw error;
        }
    }

    /**
     * Preload critical modules
     */
    async preload(modules: Array<{ name: string; importFn: () => Promise<any> }>) {
        this.logger.info('Preloading critical modules', { count: modules.length });

        const promises = modules.map(({ name, importFn }) =>
            this.load(name, importFn).catch(error => {
                this.logger.warn('Failed to preload module', error, { module: name });
                return null;
            })
        );

        await Promise.all(promises);
        this.logger.info('Module preloading completed', { loaded: this.modules.size });
    }

    getStats() {
        return {
            loadedModules: this.modules.size,
            modules: Array.from(this.modules.keys())
        };
    }
}

// Singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const lazyLoader = new LazyLoader();

// Performance decorators
export function measurePerformance(operation: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            return performanceMonitor.trackRequest(
                `${target.constructor.name}.${propertyName}`,
                () => method.apply(this, args)
            );
        };
    };
}

// Memory optimization utilities
export const MemoryUtils = {
    /**
     * Create a weak reference to avoid memory leaks
     */
    createWeakRef<T extends object>(obj: T): WeakRef<T> {
        return new WeakRef(obj);
    },

    /**
     * Deep freeze object to prevent mutations and enable V8 optimizations
     */
    deepFreeze<T>(obj: T): T {
        Object.freeze(obj);

        Object.getOwnPropertyNames(obj).forEach(prop => {
            const value = (obj as any)[prop];
            if (value && typeof value === 'object') {
                MemoryUtils.deepFreeze(value);
            }
        });

        return obj;
    },

    /**
     * Create object pool for frequently created objects
     */
    createPool<T>(factory: () => T, reset: (obj: T) => void, maxSize = 10) {
        const pool: T[] = [];

        return {
            get(): T {
                const obj = pool.pop();
                return obj || factory();
            },

            release(obj: T): void {
                if (pool.length < maxSize) {
                    reset(obj);
                    pool.push(obj);
                }
            },

            size: () => pool.length
        };
    }
};