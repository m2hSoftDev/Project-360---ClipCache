/**
 * Lightweight logger to adhere to AGENT.md rule:
 * "No console.log in committed code; use a small logger in src/shared/logger.ts."
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const PREFIX = '[ClipCache]';

export const logger = {
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(PREFIX, ...args);
    }
  },

  info: (...args: unknown[]): void => {
    console.info(PREFIX, ...args);
  },

  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args);
  },

  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args);
  },
};
