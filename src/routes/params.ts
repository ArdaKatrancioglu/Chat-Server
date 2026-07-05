import { AppError } from "../middleware/errorHandler";

export function parseStringParam(value: unknown, name: string): string {
  if (Array.isArray(value) || typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `${name} must be a non-empty string`);
  }

  return value;
}

export function parseIntParam(value: unknown, name: string): number {
  if (Array.isArray(value)) {
    throw new AppError(400, `${name} must be an integer`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new AppError(400, `${name} must be an integer`);
  }

  return parsed;
}
