import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import { logger } from "../utils/logger";
import { geocodingService, weatherService, WeatherService } from "../services";

export function getWeatherTool(server: McpServer) 
{
 server.tool(
        "get_weather",
        "Obten el tiempo de una ciudad",
        {
            city: z.string().describe("Nombre ciudad")
        },
        async ({ city }) => {
            const weatherLogger = logger.withContext('WeatherTool');

            try {
                weatherLogger.debug('Weather request received', { city });

                // Validar entrada
                if (!city || typeof city !== 'string' || city.trim().length === 0) {
                    weatherLogger.warn('Invalid city input received', { city });
                    return {
                        content: [{
                            type: "text",
                            text: "Error: El nombre de la ciudad es requerido y debe ser una cadena válida"
                        }]
                    };
                }

                const cityName = city.trim();
                weatherLogger.info('Processing weather request', { cityName });

                // Step 1: Get coordinates for city
                const coordinates = await geocodingService.getCoordinates(cityName);

                if (!coordinates) {
                    return {
                        content: [{
                            type: "text",
                            text: `No se encontró información para la ciudad: ${cityName}. Verifica la ortografía o prueba con otra ciudad.`
                        }]
                    };
                }

                // Step 2: Get weather data for coordinates
                const weatherData = await weatherService.getWeatherData(coordinates);

                // Step 3: Format and return response
                const formattedWeather = WeatherService.formatWeatherData(weatherData);

                weatherLogger.info('Weather request completed successfully', {
                    city: coordinates.name,
                    country: coordinates.country,
                    temperature: weatherData.current?.temperature
                });

                return {
                    content: [{
                        type: "text",
                        text: formattedWeather
                    }]
                };

            } catch (error) {
                weatherLogger.error('Weather tool error', error, { city });

                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

                // Handle specific error types with user-friendly messages
                let userMessage = `Error interno al obtener el clima para "${city}": ${errorMessage}`;

                if (errorMessage.includes('Timeout')) {
                    userMessage = `Timeout: La solicitud para "${city}" tardó demasiado tiempo. Inténtalo nuevamente.`;
                } else if (errorMessage.includes('HTTP')) {
                    userMessage = `Error de conexión al obtener el clima para "${city}". Verifica tu conexión a internet.`;
                }

                return {
                    content: [{
                        type: "text",
                        text: userMessage
                    }]
                };
            }
        }
    );
}