export type SqlValue = string | number | boolean | Date | Buffer | null;

export function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  return JSON.stringify(value);
}
