type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  module?: string;
  error?: unknown;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLevel(): LogLevel {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("log_level");
    if (stored && stored in LOG_LEVELS) {
      return stored as LogLevel;
    }
  }
  return "info";
}

let currentLevel: LogLevel = getLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [SHELTERMARK] [${level.toUpperCase()}]`;
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
  setLevel: (level: LogLevel) => {
    currentLevel = level;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("log_level", level);
      } catch {}
    }
  },
  getLevel: () => currentLevel,
};
