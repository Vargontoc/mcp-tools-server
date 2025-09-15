import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeocodingService } from './geocoding';

// Mock fetch
global.fetch = vi.fn();

describe('GeocodingService', () => {
  let service: GeocodingService;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    service = new GeocodingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return coordinates for valid city', async () => {
    const mockResponse = {
      results: [{
        id: 1,
        name: 'Madrid',
        latitude: 40.4168,
        longitude: -3.7038,
        country: 'Spain'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    const result = await service.getCoordinates('Madrid');

    expect(result).toEqual({
      latitude: 40.4168,
      longitude: -3.7038,
      name: 'Madrid',
      country: 'Spain'
    });
  });

  it('should return null for city not found', async () => {
    const mockResponse = { results: [] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    const result = await service.getCoordinates('NonExistentCity');
    expect(result).toBeNull();
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response);

    await expect(service.getCoordinates('Madrid'))
      .rejects.toThrow('HTTP 404: Not Found');
  });

  it('should handle invalid API response structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' })
    } as Response);

    await expect(service.getCoordinates('Madrid'))
      .rejects.toThrow('Invalid API response structure');
  });

  it('should validate coordinates ranges', () => {
    expect(GeocodingService.validateCoordinates(40.4168, -3.7038)).toBe(true);
    expect(GeocodingService.validateCoordinates(91, 0)).toBe(false); // Invalid latitude
    expect(GeocodingService.validateCoordinates(0, 181)).toBe(false); // Invalid longitude
    expect(GeocodingService.validateCoordinates(-91, 0)).toBe(false); // Invalid latitude
    expect(GeocodingService.validateCoordinates(0, -181)).toBe(false); // Invalid longitude
  });
});