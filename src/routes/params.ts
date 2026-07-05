import { AppError } from "../middleware/errorHandler";

export function parseStringParam(value: unknown, name: string): string {
  if (Array.isArray(value) || typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be a non-empty string`, {
      details: { field: name }
    });
  }

  return value;
}

export function parseIntParam(value: unknown, name: string): number {
  if (Array.isArray(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be an integer`, {
      details: { field: name }
    });
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be an integer`, {
      details: { field: name }
    });
  }

  return parsed;
}
