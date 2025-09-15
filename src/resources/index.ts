import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "../config";
import { geocodingCache, weatherCache } from "../utils/cache";
import { performanceMonitor, lazyLoader } from "../utils/performance";
import { rateLimiter } from "../utils/rate-limiter";

export function registerResources(server: McpServer) {
    // Resource de información del servidor
    server.resource(
        "server-info",
        "server-info://system",
        {
            name: "Server Information",
            description: "Información del servidor MCP",
            mimeType: "application/json"
        },
        async () => {
            try {
                const serverSettings = config.getServerSettings();
                const apiUrls = config.getApiUrls();
                const weatherSettings = config.getWeatherSettings();

                const info = {
                    ...serverSettings,
                    description: "Servidor MCP para herramientas de clima y utilidades",
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    platform: process.platform,
                    nodeVersion: process.version,
                    timestamp: new Date().toISOString(),
                    configuration: {
                        apis: apiUrls,
                        weather: weatherSettings
                    },
                    cache: {
                        geocoding: geocodingCache.getStats(),
                        weather: weatherCache.getStats()
                    },
                    performance: {
                        ...performanceMonitor.getStats(),
                        metrics: performanceMonitor.getMetrics()
                    },
                    rateLimiter: rateLimiter.getStats(),
                    lazyLoader: lazyLoader.getStats()
                };

                return {
                    contents: [
                        {
                            uri: "server-info://system",
                            mimeType: "application/json",
                            text: JSON.stringify(info, null, 2)
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                return {
                    contents: [
                        {
                            uri: "server-info://system",
                            mimeType: "application/json",
                            text: JSON.stringify({
                                error: "Error al obtener información del servidor",
                                message: errorMessage,
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Resource con lista de ciudades de ejemplo
    server.resource(
        "example-cities",
        "cities://examples",
        {
            name: "Example Cities",
            description: "Lista de ciudades de ejemplo para consultar clima",
            mimeType: "application/json"
        },
        async () => {
            try {
                const cities = [
                    { name: "Madrid", country: "España" },
                    { name: "Barcelona", country: "España" },
                    { name: "Londres", country: "Reino Unido" },
                    { name: "París", country: "Francia" },
                    { name: "Tokio", country: "Japón" },
                    { name: "Nueva York", country: "Estados Unidos" }
                ];

                return {
                    contents: [
                        {
                            uri: "cities://examples",
                            mimeType: "application/json",
                            text: JSON.stringify({
                                cities,
                                count: cities.length,
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                return {
                    contents: [
                        {
                            uri: "cities://examples",
                            mimeType: "application/json",
                            text: JSON.stringify({
                                error: "Error al obtener lista de ciudades",
                                message: errorMessage,
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }
                    ]
                };
            }
        }
    );
}