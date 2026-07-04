import { AppError } from "../middleware/errorHandler";

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
