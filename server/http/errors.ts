import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";

type ErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly details?: ErrorDetails;
  readonly cause?: unknown;

  constructor(
    status: number,
    message: string,
    options: { details?: ErrorDetails; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function badRequest(message: string, details?: ErrorDetails): ApiError {
  return new ApiError(400, message, { details });
}

export function notFound(message: string): ApiError {
  return new ApiError(404, message);
}

export function parseRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  message = "Invalid data",
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest(message, { errors: result.error.errors });
  }

  return result.data;
}

export function asApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return badRequest("Invalid data", { errors: error.errors });
  }

  return new ApiError(500, fallbackMessage, { cause: error });
}

function normalizeUploadError(error: multer.MulterError): ApiError {
  if (error.code === "LIMIT_FILE_SIZE") {
    return badRequest("Image must be 5 MB or smaller");
  }

  return badRequest("Invalid image upload");
}

function normalizeRequestParsingError(error: unknown): ApiError | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const parsed = error as { status?: unknown; type?: unknown };
  if (parsed.status === 400 && parsed.type === "entity.parse.failed") {
    return badRequest("Invalid JSON body");
  }
  if (parsed.status === 413) {
    return new ApiError(413, "Request body is too large");
  }

  return undefined;
}

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "API endpoint not found" });
};

export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized =
    error instanceof multer.MulterError
      ? normalizeUploadError(error)
      : (normalizeRequestParsingError(error) ??
        asApiError(error, "Internal Server Error"));

  const rootCause = normalized.cause ?? error;
  if (normalized.status >= 500) {
    console.error(
      `[api] ${req.method} ${req.path} failed:`,
      rootCause,
    );
  }

  res.status(normalized.status).json({
    message: normalized.message,
    ...normalized.details,
  });
};
