import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

export interface ApiErrorOptions {
  requiredAction?: string;
  details?: unknown;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
    requiredAction?: string;
    details?: unknown;
  };
}

function defaultErrorCode(statusCode: number): string {
  if (statusCode === 400) {
    return "VALIDATION_ERROR";
  }

  if (statusCode === 401) {
    return "AUTH_REQUIRED";
  }

  if (statusCode === 403) {
    return "FORBIDDEN";
  }

  if (statusCode === 404) {
    return "RESOURCE_NOT_FOUND";
  }

  if (statusCode === 409) {
    return "CONFLICT";
  }

  if (statusCode >= 500) {
    return "INTERNAL_SERVER_ERROR";
  }

  return "API_ERROR";
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  requiredAction?: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message?: string, options?: ApiErrorOptions) {
    super(message ?? code);
    this.statusCode = statusCode;
    this.code = message === undefined ? defaultErrorCode(statusCode) : code;
    this.requiredAction = options?.requiredAction;
    this.details = options?.details;
  }
}

export class AppError extends ApiError {
  constructor(statusCode: number, code: string, message?: string, options?: ApiErrorOptions) {
    super(statusCode, code, message, options);
  }
}

export function toApiErrorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      status: error.statusCode,
      ...(error.requiredAction ? { requiredAction: error.requiredAction } : {}),
      ...(error.details !== undefined ? { details: error.details } : {})
    }
  };
}

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json(toApiErrorBody(error));
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
      status: 500
    }
  });
};
