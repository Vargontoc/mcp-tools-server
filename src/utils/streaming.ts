import { logger } from './logger';

export interface StreamingOptions {
    chunkSize: number;
    delay: number; // ms between chunks
    compress?: boolean;
}

export class StreamingResponse {
    private logger = logger.withContext('StreamingResponse');

    /**
     * Stream large text responses in chunks
     */
    async streamText(text: string, options: StreamingOptions = { chunkSize: 1000, delay: 10 }) {
        const chunks = this.chunkText(text, options.chunkSize);
        const streamedChunks: string[] = [];

        this.logger.debug('Starting text streaming', {
            totalLength: text.length,
            chunks: chunks.length,
            chunkSize: options.chunkSize
        });

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            streamedChunks.push(chunk);

            // Simulate streaming delay (in real MCP, this would be actual streaming)
            if (options.delay > 0 && i < chunks.length - 1) {
                await this.delay(options.delay);
            }

            this.logger.debug('Chunk streamed', {
                chunk: i + 1,
                total: chunks.length,
                size: chunk.length
            });
        }

        return {
            content: streamedChunks.join(''),
            metadata: {
                streamed: true,
                chunks: chunks.length,
                totalSize: text.length
            }
        };
    }

    /**
     * Stream formatted weather data progressively
     */
    async streamWeatherData(data: any, options: StreamingOptions = { chunkSize: 500, delay: 5 }) {
        const sections = this.createWeatherSections(data);
        let fullResponse = '';

        this.logger.debug('Starting weather data streaming', {
            sections: sections.length
        });

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            fullResponse += section + '\n\n';

            // In a real streaming scenario, you'd yield each section
            if (options.delay > 0 && i < sections.length - 1) {
                await this.delay(options.delay);
            }

            this.logger.debug('Weather section streamed', {
                section: i + 1,
                total: sections.length,
                type: this.getSectionType(section)
            });
        }

        return {
            content: [{
                type: "text",
                text: fullResponse
            }],
            metadata: {
                streamed: true,
                sections: sections.length,
                streamingEnabled: true
            }
        };
    }

    /**
     * Create a chunked iterator for large datasets
     */
    async* createChunkedIterator<T>(data: T[], chunkSize: number = 100) {
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            yield {
                chunk,
                index: Math.floor(i / chunkSize),
                total: Math.ceil(data.length / chunkSize),
                hasMore: i + chunkSize < data.length
            };
        }
    }

    private chunkText(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];

        // Try to break at word boundaries
        const words = text.split(' ');
        let currentChunk = '';

        for (const word of words) {
            if ((currentChunk + ' ' + word).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + word;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private createWeatherSections(data: any): string[] {
        const sections: string[] = [];

        // Header section
        if (data.location) {
            sections.push(`📍 **${data.location.name}, ${data.location.country}**`);
            sections.push(`📐 Coordenadas: ${data.location.latitude.toFixed(4)}, ${data.location.longitude.toFixed(4)}`);
        }

        // Current weather section
        if (data.current) {
            sections.push(`🌡️ **Temperatura actual:** ${data.current.temperature}°C`);
            sections.push(`☔ **Precipitación:** ${data.current.precipitation}mm`);
            sections.push(`${data.current.isDay ? '☀️' : '🌙'} **Período:** ${data.current.isDay ? 'Día' : 'Noche'}`);
        }

        // Hourly forecast section
        if (data.hourly && data.hourly.temperatures.length > 0) {
            sections.push(`📈 **Pronóstico por horas:**`);
            const hourlyData = data.hourly.times.slice(0, 8).map((time: string, i: number) =>
                `  ${time}: ${data.hourly.temperatures[i]}°C`
            ).join('\n');
            sections.push(hourlyData);
        }

        // Metadata section
        if (data.metadata) {
            sections.push(`🌍 Zona horaria: ${data.metadata.timezone}`);
            sections.push(`⛰️ Elevación: ${data.metadata.elevation}m`);
        }

        return sections;
    }

    private getSectionType(section: string): string {
        if (section.includes('📍')) return 'location';
        if (section.includes('🌡️')) return 'current';
        if (section.includes('📈')) return 'forecast';
        if (section.includes('🌍')) return 'metadata';
        return 'other';
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const streamingResponse = new StreamingResponse();