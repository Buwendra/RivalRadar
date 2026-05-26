import { redactObject } from './redact';

/** Structured JSON logger for Lambda */
export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'INFO', message, ...redactObject(data ?? {}), timestamp: new Date().toISOString() }));
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'WARN', message, ...redactObject(data ?? {}), timestamp: new Date().toISOString() }));
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'ERROR', message, ...redactObject(data ?? {}), timestamp: new Date().toISOString() }));
  },
};
