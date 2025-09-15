# Configuración del MCP Server

Este documento describe cómo configurar el servidor MCP usando variables de entorno.

## Variables de Entorno

### Configuración del Servidor

| Variable | Descripción | Valor por defecto |
|----------|-------------|------------------|
| `MCP_SERVER_NAME` | Nombre del servidor MCP | `"MCP Server Custom"` |
| `MCP_SERVER_VERSION` | Versión del servidor | `"1.0.0"` |
| `LOG_LEVEL` | Nivel de logging | `"INFO"` |
| `CONNECTION_TIMEOUT_MS` | Timeout de conexión en ms | `30000` |

### URLs de APIs

| Variable | Descripción | Valor por defecto |
|----------|-------------|------------------|
| `GEOCODING_API_URL` | URL de la API de geocodificación | `"https://geocoding-api.open-meteo.com/v1/search"` |
| `WEATHER_API_URL` | URL de la API del clima | `"https://api.open-meteo.com/v1/forecast"` |

### Configuración del Clima

| Variable | Descripción | Valor por defecto | Rango/Opciones |
|----------|-------------|------------------|----------------|
| `WEATHER_LANGUAGE` | Idioma para las respuestas | `"es"` | `es`, `en`, `fr`, etc. |
| `WEATHER_FORECAST_DAYS` | Días de pronóstico | `1` | `1-16` |
| `REQUEST_TIMEOUT_MS` | Timeout de requests HTTP | `10000` | `1000-60000` |

### Niveles de Log

- `ERROR`: Solo errores críticos
- `WARN`: Advertencias y errores
- `INFO`: Información general, advertencias y errores
- `DEBUG`: Información detallada para debugging

## Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Copiar archivo de ejemplo:**
   ```bash
   cp .env.example .env
   ```

3. **Editar las variables según necesites:**
   ```bash
   # Ejemplo de configuración personalizada
   MCP_SERVER_NAME="Mi Servidor MCP"
   LOG_LEVEL="DEBUG"
   WEATHER_LANGUAGE="en"
   REQUEST_TIMEOUT_MS="15000"
   ```

4. **El servidor cargará automáticamente el archivo .env:**
   - ✅ Se ejecuta `import 'dotenv/config'` al inicio
   - ✅ Variables disponibles en `process.env`
   - ✅ Fallback a valores por defecto si no existen

5. **Variables opcionales:**
   - Si no se especifican, se usan los valores por defecto
   - Las URLs de APIs solo necesitan cambiarse para testing o APIs alternativas

## Ejemplos de Uso

### Desarrollo con Debug
```bash
LOG_LEVEL="DEBUG"
REQUEST_TIMEOUT_MS="5000"
```

### Producción
```bash
LOG_LEVEL="WARN"
REQUEST_TIMEOUT_MS="10000"
CONNECTION_TIMEOUT_MS="60000"
```

### Testing con APIs alternativas
```bash
GEOCODING_API_URL="http://localhost:3001/geocoding"
WEATHER_API_URL="http://localhost:3001/weather"
REQUEST_TIMEOUT_MS="30000"
```

## Validación

El sistema valida automáticamente:
- ✅ URLs válidas para las APIs
- ✅ Rango de días de pronóstico (1-16)
- ✅ Niveles de log válidos
- ✅ Timeouts dentro de rangos recomendados

Los valores inválidos se corrigen automáticamente y se registran advertencias.