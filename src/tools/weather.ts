import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export function getWeatherTool(server: McpServer) 
{
 server.tool(
        "get_weather",
        "Obten el tiempo de una ciudad",
        {
            city: z.string().describe("Nombre ciudad")
        },
        async ({ city }) => {
            const geoRes = await fetch(
                `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=es&format=json`
            );

            const geoJson = await geoRes.json() as any;

            if (!geoJson.results || geoJson.results.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `No se encontró información para la ciudad: ${city}`
                    }]
                };
            }

            const { latitude, longitude, name, country } = geoJson.results[0];

            const weatherRes = await fetch(
                `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&current=temperature_2m,precipitation,is_day,rain&forecast_days=1`
            );
            const weatherJson = await weatherRes.json();

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(
                        {
                            location: { name, country, latitude, longitude },
                            data: weatherJson
                        },
                        null,
                        2
                    )
                }]
            };
        }
    );
}