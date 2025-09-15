export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: string;
    error?: any;
    metadata?: Record<string, any>;
}

export class Logger {
    private logLevel: LogLevel;
    private context: string;

    constructor(context: string = 'MCP-Server', logLevel: LogLevel = LogLevel.INFO) {
        this.context = context;
        this.logLevel = logLevel;
    }

    private formatLog(level: string, message: string, error?: any, metadata?: Record<string, any>): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: this.context
        };

        if (error) {
            entry.error = {
                message: error.message || error,
                stack: error.stack,
                name: error.name
            };
        }

        if (metadata) {
            entry.metadata = metadata;
        }

        return entry;
    }

    private log(level: LogLevel, levelName: string, message: string, error?: any, metadata?: Record<string, any>): void {
        if (level <= this.logLevel) {
            const logEntry = this.formatLog(levelName, message, error, metadata);

            // Use console.error for MCP server communication (stderr)
            console.error(JSON.stringify(logEntry, null, 2));
        }
    }

    error(message: string, error?: any, metadata?: Record<string, any>): void {
        this.log(LogLevel.ERROR, 'ERROR', message, error, metadata);
    }

    warn(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.WARN, 'WARN', message, undefined, metadata);
    }

    info(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.INFO, 'INFO', message, undefined, metadata);
    }

    debug(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, undefined, metadata);
    }

    withContext(context: string): Logger {
        return new Logger(context, this.logLevel);
    }
}

// Default logger instance
export const logger = new Logger();