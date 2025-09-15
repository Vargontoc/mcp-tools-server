import { z } from 'zod';

// Zod Schemas for API Validation

export const GeocodingResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  feature_code: z.string().optional(),
  country_code: z.string().optional(),
  admin1_id: z.number().optional(),
  admin2_id: z.number().optional(),
  admin3_id: z.number().optional(),
  admin4_id: z.number().optional(),
  timezone: z.string().optional(),
  population: z.number().optional(),
  country_id: z.number().optional(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  admin3: z.string().optional(),
  admin4: z.string().optional(),
});

export const GeocodingResponseSchema = z.object({
  results: z.array(GeocodingResultSchema).optional(),
  generationtime_ms: z.number().optional(),
});

export const WeatherCurrentSchema = z.object({
  time: z.string(),
  interval: z.number(),
  temperature_2m: z.number(),
  precipitation: z.number(),
  is_day: z.number(),
  rain: z.number(),
});

export const WeatherHourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number()),
});

export const WeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number(),
  utc_offset_seconds: z.number().optional(),
  timezone: z.string(),
  timezone_abbreviation: z.string(),
  elevation: z.number(),
  current_units: z.record(z.string()).optional(),
  current: WeatherCurrentSchema.optional(),
  hourly_units: z.record(z.string()).optional(),
  hourly: WeatherHourlySchema.optional(),
});

// TypeScript types derived from schemas
export type GeocodingResult = z.infer<typeof GeocodingResultSchema>;
export type GeocodingResponse = z.infer<typeof GeocodingResponseSchema>;
export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;
export type WeatherHourly = z.infer<typeof WeatherHourlySchema>;
export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
