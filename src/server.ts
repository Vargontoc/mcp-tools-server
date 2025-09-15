import 'dotenv/config';
import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { logger } from "./utils/logger";
import config from "./config";
import { performanceMonitor, lazyLoader } from "./utils/performance";
import { healthMonitor } from "./utils/health";

// Get server configuration
const serverSettings = config.getServerSettings();

const server = new McpServer({
    name: serverSettings.name,
    version: serverSettings.version,
    capabilities: {
        resources: {
            "subscribe": true,
            "listChanged": true
        },
        tools: {}
    }
})

// Register tools and resources with error handling
try {
    registerTools(server)
    logger.info("Tools registered successfully")
} catch (error) {
    logger.error("Error registering tools", error)
    process.exit(1)
}

try {
    registerResources(server)
    logger.info("Resources registered successfully")
} catch (error) {
    logger.error("Error registering resources", error)
    process.exit(1)
}

async function main() {
    try {
        const transport = new StdioServerTransport()

        // Add connection timeout from config
        const connectionTimeout = setTimeout(() => {
            logger.error(`Connection timeout - failed to connect after ${serverSettings.connectionTimeout/1000} seconds`)
            process.exit(1)
        }, serverSettings.connectionTimeout)

        await server.connect(transport)
        clearTimeout(connectionTimeout)

        logger.info("MCP Server running successfully", {
            name: serverSettings.name,
            version: serverSettings.version,
            pid: process.pid,
            performance: performanceMonitor.getStats(),
            config: {
                logLevel: serverSettings.logLevel,
                connectionTimeout: serverSettings.connectionTimeout,
                ...config.getApiUrls(),
                ...config.getWeatherSettings()
            }
        })

        // Initial health check
        try {
            const initialHealth = await healthMonitor.getHealthStatus();
            logger.info("Initial health check completed", {
                status: initialHealth.status,
                checks: initialHealth.checks.length,
                failedChecks: initialHealth.checks.filter(c => c.status === 'fail').length
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            logger.warn("Initial health check failed", { error: errorMessage });
        }

        // Start periodic performance monitoring
        setInterval(() => {
            const stats = performanceMonitor.getStats();
            const metrics = performanceMonitor.getMetrics();

            if (metrics.memoryUsage.heapUsed / 1024 / 1024 > 50) { // > 50MB
                logger.warn('High memory usage detected', {
                    heapUsed: `${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                    requests: stats.requests.total,
                    avgResponseTime: `${stats.requests.averageResponseTime.toFixed(2)}ms`
                });
            }

            // Force GC if memory is high (requires --expose-gc flag)
            if (metrics.memoryUsage.heapUsed / 1024 / 1024 > 100) {
                performanceMonitor.forceGC();
            }
        }, 60000); // Every minute

        // Graceful shutdown handlers
        process.on('SIGTERM', () => {
            logger.info("SIGTERM received, shutting down gracefully")
            // Log final health status
            healthMonitor.getQuickHealth().then(health => {
                logger.info("Final health status", health);
            }).catch(() => {
                logger.warn("Could not get final health status");
            }).finally(() => {
                process.exit(0);
            });
        })

        process.on('SIGINT', () => {
            logger.info("SIGINT received, shutting down gracefully")
            // Log final health status
            healthMonitor.getQuickHealth().then(health => {
                logger.info("Final health status", health);
            }).catch(() => {
                logger.warn("Could not get final health status");
            }).finally(() => {
                process.exit(0);
            });
        })

    } catch (error) {
        logger.error("Error connecting server", error)
        process.exit(1)
    }
}

// Enhanced error handling for main function
main().catch((error) => {
    logger.error("Fatal error in main()", error, {
        message: error.message || "Unknown error",
        stack: error.stack || "No stack trace available"
    })
    process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', reason, {
        promise: promise.toString(),
        reason: reason
    })
    process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error, {
        message: error.message,
        stack: error.stack
    })
    process.exit(1)
})