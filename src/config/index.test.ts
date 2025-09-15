import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ConfigManager', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should load default configuration when no env vars set', () => {
    // Clear env vars
    delete process.env.MCP_SERVER_NAME;
    delete process.env.LOG_LEVEL;
    delete process.env.GEOCODING_API_URL;

    // Import fresh config
    delete require.cache[require.resolve('./index')];
    const { ConfigManager } = require('./index');
    const config = new ConfigManager();

    const settings = config.getServerSettings();
    expect(settings.name).toBe('MCP Server Custom');
    expect(settings.logLevel).toBe('INFO');
  });

  it('should load env variables when provided', () => {
    process.env.MCP_SERVER_NAME = 'Test Server';
    process.env.LOG_LEVEL = 'DEBUG';
    process.env.WEATHER_LANGUAGE = 'en';

    delete require.cache[require.resolve('./index')];
    const { ConfigManager } = require('./index');
    const config = new ConfigManager();

    const settings = config.getServerSettings();
    expect(settings.name).toBe('Test Server');
    expect(settings.logLevel).toBe('DEBUG');

    const weather = config.getWeatherSettings();
    expect(weather.language).toBe('en');
  });

  it('should validate and correct invalid log level', () => {
    process.env.LOG_LEVEL = 'INVALID';

    delete require.cache[require.resolve('./index')];
    const { ConfigManager } = require('./index');
    const config = new ConfigManager();

    const settings = config.getServerSettings();
    expect(settings.logLevel).toBe('INFO'); // Should fallback to INFO
  });

  it('should validate URL format', () => {
    process.env.GEOCODING_API_URL = 'invalid-url';

    delete require.cache[require.resolve('./index.js')];

    expect(() => {
      const { ConfigManager } = require('./index.js');
      new ConfigManager();
    }).toThrow('Invalid API URL configuration');
  });

  it('should validate numeric ranges', () => {
    process.env.WEATHER_FORECAST_DAYS = '20'; // Invalid: > 16

    delete require.cache[require.resolve('./index.js')];

    expect(() => {
      const { ConfigManager } = require('./index.js');
      new ConfigManager();
    }).toThrow('Weather forecast days must be between 1 and 16');
  });
});