/**
 * Structured logging utility for Cloudflare Workers
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    // Debug logs only in development
    // In production, these are suppressed to reduce noise
    // eslint-disable-next-line no-console
    console.log(this.formatMessage('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    console.error(this.formatMessage('error', message, errorContext));
  }
}

export const logger = new Logger();
