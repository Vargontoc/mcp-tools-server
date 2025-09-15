import { describe, it, expect } from 'vitest';
import {
  GeocodingResponseSchema,
  WeatherResponseSchema,
  GeocodingResultSchema
} from './index';

describe('Zod Schemas', () => {
  describe('GeocodingResultSchema', () => {
    it('should validate valid geocoding result', () => {
      const validData = {
        id: 1,
        name: 'Madrid',
        latitude: 40.4168,
        longitude: -3.7038,
        country: 'Spain'
      };

      const result = GeocodingResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid geocoding result', () => {
      const invalidData = {
        id: 'invalid', // Should be number
        name: 'Madrid',
        latitude: 40.4168
        // Missing longitude
      };

      const result = GeocodingResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('GeocodingResponseSchema', () => {
    it('should validate empty results', () => {
      const validData = { results: [] };

      const result = GeocodingResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('WeatherResponseSchema', () => {
    it('should validate complete weather response', () => {
      const validData = {
        latitude: 40.4168,
        longitude: -3.7038,
        generationtime_ms: 0.123,
        utc_offset_seconds: 3600,
        timezone: 'Europe/Madrid',
        timezone_abbreviation: 'CET',
        elevation: 650,
        current: {
          time: '2024-01-01T12:00:00Z',
          interval: 900,
          temperature_2m: 15.5,
          precipitation: 0.0,
          is_day: 1,
          rain: 0.0
        }
      };

      const result = WeatherResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject incomplete weather response', () => {
      const invalidData = {
        latitude: 40.4168
        // Missing required fields
      };

      const result = WeatherResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});