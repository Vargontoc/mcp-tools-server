import { logger } from '../utils/logger';
import config from '../config';
import { GeocodingResponseSchema } from '../types';
import { rateLimiter, RATE_LIMITS } from '../utils/rate-limiter';
import { geocodingCache } from '../utils/cache';

export interface GeolocationResult {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
}

export class GeocodingService {
    private logger = logger.withContext('GeocodingService');
    private apiUrl: string;
    private requestTimeout: number;

    constructor() {
        const { geocoding } = config.getApiUrls();
        const { requestTimeout } = config.getWeatherSettings();

        this.apiUrl = geocoding;
        this.requestTimeout = requestTimeout;
    }

    async getCoordinates(city: string): Promise<GeolocationResult | null> {
        this.logger.debug('Starting geocoding request', { city });

        // Check cache first
        const cacheKey = `geocoding:${city.toLowerCase().trim()}`;
        const cachedResult = geocodingCache.get(cacheKey);

        if (cachedResult) {
            this.logger.debug('Geocoding cache hit', { city });
            return cachedResult;
        }

        // Check rate limit
        const rateLimitKey = `geocoding:${this.apiUrl}`;
        const rateLimitResult = rateLimiter.checkLimit(rateLimitKey, RATE_LIMITS.GEOCODING_API);

        if (!rateLimitResult.allowed) {
            throw new Error(`Rate limit exceeded for geocoding API. Try again in ${rateLimitResult.retryAfter}s`);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const url = this.buildGeocodingUrl(city);
            this.logger.debug('Geocoding URL built', { url });

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'MCP-Server/1.0.0'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                this.logger.error('Geocoding API HTTP error', null, {
                    status: response.status,
                    statusText: response.statusText,
                    city
                });
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const rawData = await response.json();
            this.logger.debug('Raw geocoding response received', {
                dataKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData) : 'invalid_data'
            });

            // Validate response structure
            const validation = GeocodingResponseSchema.safeParse(rawData);
            if (!validation.success) {
                this.logger.error('Invalid geocoding response structure', null, {
                    city,
                    errors: validation.error.errors,
                    response: rawData
                });
                throw new Error('Invalid API response structure');
            }

            const data = validation.data;

            if (!data.results || data.results.length === 0) {
                this.logger.warn('No geocoding results found', { city });
                // Cache negative result for shorter time
                geocodingCache.set(cacheKey, null, 30 * 60 * 1000); // 30 minutes
                return null;
            }

            const result = data.results[0];
            const coordinates: GeolocationResult = {
                latitude: result.latitude,
                longitude: result.longitude,
                name: result.name,
                country: result.country || 'Unknown'
            };

            // Cache successful result
            geocodingCache.set(cacheKey, coordinates);

            this.logger.info('Geocoding successful and cached', {
                city,
                result: coordinates
            });

            return coordinates;

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.warn('Geocoding request timeout', { city, timeout: this.requestTimeout });
                throw new Error(`Timeout after ${this.requestTimeout/1000}s`);
            }

            this.logger.error('Geocoding request failed', error, { city });
            throw error;
        }
    }

    private buildGeocodingUrl(city: string): string {
        const { language } = config.getWeatherSettings();

        const params = new URLSearchParams({
            name: city.trim(),
            count: '1',
            language,
            format: 'json'
        });

        return `${this.apiUrl}?${params.toString()}`;
    }

    /**
     * Validate coordinates are within valid ranges
     */
    static validateCoordinates(latitude: number, longitude: number): boolean {
        return latitude >= -90 && latitude <= 90 &&
               longitude >= -180 && longitude <= 180;
    }
}

export const geocodingService = new GeocodingService();