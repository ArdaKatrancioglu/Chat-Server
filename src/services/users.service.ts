import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { User } from "../types/db";
import { toSqlValue } from "../types/sql";

type UserRow = User & RowDataPacket;

export async function createUser(data: Record<string, unknown>): Promise<User> {
  const { id, username = null, email = null } = data;

  if (typeof id !== "number" || !Number.isInteger(id)) {
    throw new AppError(400, "id must be an integer");
  }

  await pool.execute("INSERT INTO `USER` (`id`, `username`, `email`) VALUES (?, ?, ?)", [
    id,
    toSqlValue(username),
    toSqlValue(email)
  ]);

  return getUserById(id);
}

export async function getUserById(id: number): Promise<User> {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM `USER` WHERE `id` = ? LIMIT 1", [id]);
  const user = rows[0];

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
}

export async function updateUser(id: number, data: Record<string, unknown>): Promise<User> {
  const allowedColumns = ["username", "email"];
  const columns = allowedColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));

  if (columns.length === 0) {
    throw new AppError(400, "No valid user fields provided");
  }

  const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
  const values = columns.map((column) => toSqlValue(data[column]));
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE \`USER\` SET ${assignments} WHERE \`id\` = ?`,
    [...values, id]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, "User not found");
  }

  return getUserById(id);
}
