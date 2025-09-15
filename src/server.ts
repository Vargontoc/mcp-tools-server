import 'dotenv/config';
import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { logger } from "./utils/logger";
import config from "./config";

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
            config: {
                logLevel: serverSettings.logLevel,
                connectionTimeout: serverSettings.connectionTimeout,
                ...config.getApiUrls(),
                ...config.getWeatherSettings()
            }
        })

        // Graceful shutdown handlers
        process.on('SIGTERM', () => {
            logger.info("SIGTERM received, shutting down gracefully")
            process.exit(0)
        })

        process.on('SIGINT', () => {
            logger.info("SIGINT received, shutting down gracefully")
            process.exit(0)
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