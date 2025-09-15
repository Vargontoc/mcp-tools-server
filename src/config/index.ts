import { logger } from '../utils/logger';

export interface ServerConfig {
  // Server settings
  name: string;
  version: string;
  logLevel: string;

  // API URLs
  geocodingApiUrl: string;
  weatherApiUrl: string;

  // API settings
  weatherLanguage: string;
  weatherForecastDays: number;
  requestTimeoutMs: number;

  // Connection settings
  connectionTimeoutMs: number;
}

class ConfigManager {
  private config: ServerConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): ServerConfig {
    return {
      // Server settings
      name: process.env.MCP_SERVER_NAME || "MCP Server Custom",
      version: process.env.MCP_SERVER_VERSION || "1.0.0",
      logLevel: process.env.LOG_LEVEL || "INFO",

      // API URLs - configurable for different providers or testing
      geocodingApiUrl: process.env.GEOCODING_API_URL || "https://geocoding-api.open-meteo.com/v1/search",
      weatherApiUrl: process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast",

      // API settings
      weatherLanguage: process.env.WEATHER_LANGUAGE || "es",
      weatherForecastDays: parseInt(process.env.WEATHER_FORECAST_DAYS || "1"),
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "10000"),

      // Connection settings
      connectionTimeoutMs: parseInt(process.env.CONNECTION_TIMEOUT_MS || "30000")
    };
  }

  private validateConfig(): void {
    const configLogger = logger.withContext('ConfigManager');

    // Validate URLs
    try {
      new URL(this.config.geocodingApiUrl);
      new URL(this.config.weatherApiUrl);
    } catch (error) {
      configLogger.error('Invalid API URL configuration', error);
      throw new Error('Invalid API URL configuration');
    }

    // Validate numeric values
    if (this.config.weatherForecastDays < 1 || this.config.weatherForecastDays > 16) {
      configLogger.error('Invalid weather forecast days', null, {
        value: this.config.weatherForecastDays,
        allowed: '1-16'
      });
      throw new Error('Weather forecast days must be between 1 and 16');
    }

    if (this.config.requestTimeoutMs < 1000 || this.config.requestTimeoutMs > 60000) {
      configLogger.warn('Request timeout outside recommended range', {
        value: this.config.requestTimeoutMs,
        recommended: '1000-60000ms'
      });
    }

    // Validate log level
    const validLogLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    if (!validLogLevels.includes(this.config.logLevel.toUpperCase())) {
      configLogger.warn('Invalid log level, using INFO', {
        provided: this.config.logLevel,
        valid: validLogLevels
      });
      this.config.logLevel = 'INFO';
    }

    configLogger.info('Configuration loaded and validated', {
      name: this.config.name,
      version: this.config.version,
      logLevel: this.config.logLevel,
      geocodingApiUrl: this.config.geocodingApiUrl,
      weatherApiUrl: this.config.weatherApiUrl
    });
  }

  public get(): ServerConfig {
    return { ...this.config };
  }

  public getApiUrls() {
    return {
      geocoding: this.config.geocodingApiUrl,
      weather: this.config.weatherApiUrl
    };
  }

  public getWeatherSettings() {
    return {
      language: this.config.weatherLanguage,
      forecastDays: this.config.weatherForecastDays,
      requestTimeout: this.config.requestTimeoutMs
    };
  }

  public getServerSettings() {
    return {
      name: this.config.name,
      version: this.config.version,
      logLevel: this.config.logLevel,
      connectionTimeout: this.config.connectionTimeoutMs
    };
  }
}

// Export singleton instance
export const config = new ConfigManager();
export default config;