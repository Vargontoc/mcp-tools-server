import { logger } from '../utils/logger';
import config from '../config';
import { WeatherResponse, WeatherResponseSchema } from '../types';
import { GeolocationResult } from './geocoding';

export interface WeatherData {
    location: GeolocationResult;
    current?: {
        temperature: number;
        precipitation: number;
        isDay: boolean;
        rain: number;
        time: string;
    };
    hourly?: {
        temperatures: number[];
        times: string[];
    };
    metadata: {
        timezone: string;
        elevation: number;
        generationTime: number;
    };
}

export class WeatherService {
    private logger = logger.withContext('WeatherService');
    private apiUrl: string;
    private requestTimeout: number;
    private forecastDays: number;

    constructor() {
        const { weather } = config.getApiUrls();
        const { requestTimeout, forecastDays } = config.getWeatherSettings();

        this.apiUrl = weather;
        this.requestTimeout = requestTimeout;
        this.forecastDays = forecastDays;
    }

    async getWeatherData(location: GeolocationResult): Promise<WeatherData> {
        this.logger.debug('Starting weather request', { location });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const url = this.buildWeatherUrl(location);
            this.logger.debug('Weather URL built', { url });

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'MCP-Server/1.0.0'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                this.logger.error('Weather API HTTP error', null, {
                    status: response.status,
                    statusText: response.statusText,
                    location: location.name
                });
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const rawData = await response.json();
            this.logger.debug('Raw weather response received', {
                dataKeys: Object.keys(rawData),
                location: location.name
            });

            // Validate response structure
            const validation = WeatherResponseSchema.safeParse(rawData);
            if (!validation.success) {
                this.logger.error('Invalid weather response structure', null, {
                    location: location.name,
                    errors: validation.error.errors,
                    response: rawData
                });
                throw new Error('Invalid API response structure');
            }

            const data = validation.data;
            const weatherData = this.transformWeatherData(location, data);

            this.logger.info('Weather request successful', {
                location: location.name,
                temperature: weatherData.current?.temperature,
                hasHourlyData: !!weatherData.hourly
            });

            return weatherData;

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.warn('Weather request timeout', {
                    location: location.name,
                    timeout: this.requestTimeout
                });
                throw new Error(`Timeout after ${this.requestTimeout/1000}s`);
            }

            this.logger.error('Weather request failed', error, { location: location.name });
            throw error;
        }
    }

    private buildWeatherUrl(location: GeolocationResult): string {
        const params = new URLSearchParams({
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            hourly: 'temperature_2m',
            current: 'temperature_2m,precipitation,is_day,rain',
            forecast_days: this.forecastDays.toString()
        });

        return `${this.apiUrl}?${params.toString()}`;
    }

    private transformWeatherData(location: GeolocationResult, data: WeatherResponse): WeatherData {
        const weatherData: WeatherData = {
            location,
            metadata: {
                timezone: data.timezone,
                elevation: data.elevation,
                generationTime: data.generationtime_ms
            }
        };

        // Transform current weather data
        if (data.current) {
            weatherData.current = {
                temperature: data.current.temperature_2m,
                precipitation: data.current.precipitation,
                isDay: data.current.is_day === 1,
                rain: data.current.rain,
                time: data.current.time
            };
        }

        // Transform hourly weather data
        if (data.hourly) {
            weatherData.hourly = {
                temperatures: data.hourly.temperature_2m,
                times: data.hourly.time
            };
        }

        return weatherData;
    }

    /**
     * Format weather data for human-readable output
     */
    static formatWeatherData(data: WeatherData): string {
        const parts = [
            `📍 **${data.location.name}, ${data.location.country}**`,
            `📐 Coordenadas: ${data.location.latitude.toFixed(4)}, ${data.location.longitude.toFixed(4)}`,
            `⛰️ Elevación: ${data.metadata.elevation}m`,
            `🌍 Zona horaria: ${data.metadata.timezone}`,
            ''
        ];

        if (data.current) {
            parts.push(
                `🌡️ **Temperatura actual:** ${data.current.temperature}°C`,
                `☔ **Precipitación:** ${data.current.precipitation}mm`,
                `🌧️ **Lluvia:** ${data.current.rain}mm`,
                `${data.current.isDay ? '☀️' : '🌙'} **Período:** ${data.current.isDay ? 'Día' : 'Noche'}`,
                `🕐 **Última actualización:** ${data.current.time}`,
                ''
            );
        }

        if (data.hourly && data.hourly.temperatures.length > 0) {
            parts.push(
                `📈 **Pronóstico por horas:**`,
                ...data.hourly.times.slice(0, 8).map((time, i) =>
                    `  ${time}: ${data.hourly!.temperatures[i]}°C`
                )
            );
        }

        return parts.join('\n');
    }
}

export const weatherService = new WeatherService();