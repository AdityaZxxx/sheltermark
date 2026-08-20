type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured context carried alongside a log line. Concrete optional fields
 * only — callers name what they are logging, and the console transport prints
 * whatever it receives.
 */
interface LogContext {
  module?: string;
  message?: string;
  error?: unknown;
  url?: string;
  userId?: string;
  bookmarkId?: string;
  mutationKey?: readonly unknown[];
  variables?: unknown;
  digest?: string;
  name?: string;
  stack?: string;
  status?: string;
  success?: boolean;
  written?: boolean;
  synced?: number;
  checked?: number;
  broken?: number;
  likely?: number;
  unknown?: number;
  updated?: number;
  removedBookmarks?: number;
  removedWorkspaces?: number;
  errorCount?: number;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const satisfies Record<LogLevel, number>;

function isLogLevel(value: string): value is LogLevel {
  return (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  );
}

const configuredLevel = process.env.NEXT_PUBLIC_LOG_LEVEL;
const currentLevel: LogLevel =
  configuredLevel !== undefined && isLogLevel(configuredLevel)
    ? configuredLevel
    : "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const moduleTag = context?.module ? `[${context.module}]` : "";
  return `${prefix}${moduleTag} ${message}`;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;
  const formatted = formatMessage(level, message, context);
  const rest = context ? { ...context, module: undefined } : undefined;

  switch (level) {
    case "error":
      console.error(formatted, rest ?? "");
      break;
    case "warn":
      console.warn(formatted, rest ?? "");
      break;
    case "info":
      console.info(formatted, rest ?? "");
      break;
    case "debug":
      console.debug(formatted, rest ?? "");
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
  info: (message: string, context?: LogContext) =>
    log("info", message, context),
  warn: (message: string, context?: LogContext) =>
    log("warn", message, context),
  error: (message: string, context?: LogContext) =>
    log("error", message, context),
};
