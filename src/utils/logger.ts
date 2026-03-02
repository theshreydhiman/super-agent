type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
    debug: '\x1b[90m',   // gray
    info: '\x1b[36m',    // cyan
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

const ICONS = {
    debug: '🔍',
    info: '📋',
    warn: '⚠️',
    error: '❌',
};

class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
        const timestamp = new Date().toISOString();
        const color = COLORS[level];
        const icon = ICONS[level];
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `${COLORS.bold}${color}${icon} [${timestamp}] [${level.toUpperCase()}] [${this.context}]${COLORS.reset} ${message}${metaStr}`;
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        if (process.env.LOG_LEVEL === 'debug') {
            console.log(this.format('debug', message, meta));
        }
    }

    info(message: string, meta?: Record<string, unknown>): void {
        console.log(this.format('info', message, meta));
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        console.warn(this.format('warn', message, meta));
    }

    error(message: string, meta?: Record<string, unknown>): void {
        console.error(this.format('error', message, meta));
    }
}

export function createLogger(context: string): Logger {
    return new Logger(context);
}
