export function error(message: string, meta?: unknown): void {
  try {
    if (meta !== undefined) {
      console.error(`[flow-comments] ${message}`, meta);
    } else {
      console.error(`[flow-comments] ${message}`);
    }
  } catch {
    // swallow logger failures
  }
}

export function warn(message: string, meta?: unknown): void {
  try {
    if (meta !== undefined) {
      console.warn(`[flow-comments] ${message}`, meta);
    } else {
      console.warn(`[flow-comments] ${message}`);
    }
  } catch {
    // swallow logger failures
  }
}

export function info(message: string, meta?: unknown): void {
  try {
    if (meta !== undefined) {
      console.info(`[flow-comments] ${message}`, meta);
    } else {
      console.info(`[flow-comments] ${message}`);
    }
  } catch {
    // swallow logger failures
  }
}

export interface Logger {
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
}

export const logger: Logger = { error, warn, info };