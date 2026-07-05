import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { User } from "../types/db";
import { toSqlValue } from "../types/sql";

type UserRow = User & RowDataPacket;

export async function createUser(data: Record<string, unknown>): Promise<User> {
  const { id, username = null, email = null } = data;

  if (typeof id !== "string" || id.trim() === "") {
    throw new AppError(400, "MISSING_REQUIRED_FIELD", "id must be a non-empty string", {
      details: { field: "id" }
    });
  }

  try {
    await pool.execute("INSERT INTO `USER` (`id`, `username`, `email`) VALUES (?, ?, ?)", [
      id,
      toSqlValue(username),
      toSqlValue(email)
    ]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ER_DUP_ENTRY"
    ) {
      throw new AppError(409, "USER_ALREADY_EXISTS", "User already exists.");
    }

    throw error;
  }

  return getUserById(id);
}

export async function listUsers(): Promise<User[]> {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM `USER` ORDER BY `id`");
  return rows;
}

export async function getUserById(id: string): Promise<User> {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM `USER` WHERE `id` = ? LIMIT 1", [id]);
  const user = rows[0];

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }

  return user;
}

export async function updateUser(id: string, data: Record<string, unknown>): Promise<User> {
  const allowedColumns = ["username", "email"];
  const columns = allowedColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));

  if (columns.length === 0) {
    throw new AppError(400, "INVALID_REQUEST_BODY", "No valid user fields provided.", {
      details: { fields: ["username", "email"] }
    });
  }

  const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
  const values = columns.map((column) => toSqlValue(data[column]));
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE \`USER\` SET ${assignments} WHERE \`id\` = ?`,
    [...values, id]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }

  return getUserById(id);
}
