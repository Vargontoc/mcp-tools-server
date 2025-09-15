import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherService } from './weather';
import type { GeolocationResult, WeatherData } from './index';

// Mock fetch
global.fetch = vi.fn();

describe('WeatherService', () => {
  let service: WeatherService;
  const mockFetch = vi.mocked(fetch);

  const mockLocation: GeolocationResult = {
    latitude: 40.4168,
    longitude: -3.7038,
    name: 'Madrid',
    country: 'Spain'
  };

  beforeEach(() => {
    service = new WeatherService();
    vi.clearAllMocks();
  });

  it('should return weather data for valid location', async () => {
    const mockResponse = {
      latitude: 40.4168,
      longitude: -3.7038,
      generationtime_ms: 0.123,
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
      },
      hourly: {
        time: ['2024-01-01T12:00:00Z', '2024-01-01T13:00:00Z'],
        temperature_2m: [15.5, 16.0]
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    const result = await service.getWeatherData(mockLocation);

    expect(result.location).toEqual(mockLocation);
    expect(result.current?.temperature).toBe(15.5);
    expect(result.current?.isDay).toBe(true);
    expect(result.hourly?.temperatures).toEqual([15.5, 16.0]);
    expect(result.metadata.timezone).toBe('Europe/Madrid');
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    await expect(service.getWeatherData(mockLocation))
      .rejects.toThrow('HTTP 500: Internal Server Error');
  });

  it('should handle invalid API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' })
    } as Response);

    await expect(service.getWeatherData(mockLocation))
      .rejects.toThrow('Invalid API response structure');
  });

  it('should format weather data correctly', () => {
    const mockWeatherData: WeatherData = {
      location: mockLocation,
      current: {
        temperature: 15.5,
        precipitation: 0.2,
        isDay: true,
        rain: 0.1,
        time: '2024-01-01T12:00:00Z'
      },
      hourly: {
        temperatures: [15.5, 16.0, 16.5],
        times: ['12:00', '13:00', '14:00']
      },
      metadata: {
        timezone: 'Europe/Madrid',
        elevation: 650,
        generationTime: 0.123
      }
    };

    const formatted = WeatherService.formatWeatherData(mockWeatherData);

    expect(formatted).toContain('Madrid, Spain');
    expect(formatted).toContain('15.5°C');
    expect(formatted).toContain('☀️'); // Day indicator
    expect(formatted).toContain('650m'); // Elevation
  });

  it('should handle weather data without current info', () => {
    const mockWeatherData: WeatherData = {
      location: mockLocation,
      metadata: {
        timezone: 'Europe/Madrid',
        elevation: 650,
        generationTime: 0.123
      }
    };

    const formatted = WeatherService.formatWeatherData(mockWeatherData);

    expect(formatted).toContain('Madrid, Spain');
    expect(formatted).not.toContain('°C'); // No temperature info
  });
});