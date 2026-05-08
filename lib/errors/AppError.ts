import { HTTP_STATUS, type HttpStatus } from "./codes";

class AppError extends Error {
  constructor(
    message: string,
    public readonly status: HttpStatus = HTTP_STATUS.INTERNAL_ERROR,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export function fromSupabaseError(error: {
  message: string;
  code?: string;
}): AppError {
  const code = error.code ?? "DATABASE_ERROR";
  const message = error.message;

  if (code === "P2002") {
    return new AppError(
      message,
      HTTP_STATUS.CONFLICT,
      "UNIQUE_CONSTRAINT_FAILED",
      error,
    );
  }
  if (code === "P2003") {
    return new AppError(
      message,
      HTTP_STATUS.BAD_REQUEST,
      "FOREIGN_KEY_CONSTRAINT_FAILED",
      error,
    );
  }
  if (code === "P0001") {
    return new AppError(
      message,
      HTTP_STATUS.INTERNAL_ERROR,
      "DATABASE_ERROR",
      error,
    );
  }

  return new AppError(message, HTTP_STATUS.INTERNAL_ERROR, code, error);
}

export type { ZodIssue } from "zod";

export function fromZodError(
  issues: { message: string; path: (string | number)[] }[],
): AppError {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return new AppError(
      "Validation failed",
      HTTP_STATUS.BAD_REQUEST,
      "VALIDATION_ERROR",
      issues,
    );
  }
  const path = firstIssue.path.join(".");
  const message = path
    ? `${firstIssue.message} at "${path}"`
    : (firstIssue.message ?? "Validation failed");

  return new AppError(
    message,
    HTTP_STATUS.BAD_REQUEST,
    "VALIDATION_ERROR",
    issues,
  );
}

export function fromUnknownError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      HTTP_STATUS.INTERNAL_ERROR,
      "INTERNAL_ERROR",
      error,
    );
  }

  return new AppError(
    "An unexpected error occurred",
    HTTP_STATUS.INTERNAL_ERROR,
    "UNKNOWN_ERROR",
    error,
  );
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toActionError(error: AppError | unknown): {
  code: string;
  message: string;
} {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }

  return { code: "UNKNOWN_ERROR", message: "An unexpected error occurred" };
}
