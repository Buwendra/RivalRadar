/** Structured JSON logger for Lambda */
export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() }));
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'WARN', message, ...data, timestamp: new Date().toISOString() }));
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'ERROR', message, ...data, timestamp: new Date().toISOString() }));
  },
};
