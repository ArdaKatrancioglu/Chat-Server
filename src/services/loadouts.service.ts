import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { UserLoadout } from "../types/db";
import { toSqlValue } from "../types/sql";

type LoadoutRow = UserLoadout & RowDataPacket;

const loadoutColumns = [
  "loadout_id",
  "slot_index",
  "primary_gun_id",
  "secondary_gun_id",
  "knife_id",
  "throwable_id"
];

export async function listUserLoadouts(userId: number): Promise<UserLoadout[]> {
  const [rows] = await pool.execute<LoadoutRow[]>(
    "SELECT * FROM `USER_LOADOUT` WHERE `user_id` = ? ORDER BY `slot_index`, `loadout_id`",
    [userId]
  );

  return rows;
}

export async function getUserLoadout(userId: number, loadoutId: number): Promise<UserLoadout> {
  const [rows] = await pool.execute<LoadoutRow[]>(
    "SELECT * FROM `USER_LOADOUT` WHERE `user_id` = ? AND `loadout_id` = ? LIMIT 1",
    [userId, loadoutId]
  );

  if (!rows[0]) {
    throw new AppError(404, "Loadout not found");
  }

  return rows[0];
}

export async function createUserLoadout(
  userId: number,
  data: Record<string, unknown>
): Promise<UserLoadout> {
  if (typeof data.loadout_id !== "number" || !Number.isInteger(data.loadout_id)) {
    throw new AppError(400, "loadout_id must be an integer");
  }

  const values = loadoutColumns.map((column) => toSqlValue(data[column]));
  await pool.execute(
    "INSERT INTO `USER_LOADOUT` (`user_id`, `loadout_id`, `slot_index`, `primary_gun_id`, `secondary_gun_id`, `knife_id`, `throwable_id`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, ...values]
  );

  return getUserLoadout(userId, data.loadout_id);
}

export async function updateUserLoadout(
  userId: number,
  loadoutId: number,
  data: Record<string, unknown>
): Promise<UserLoadout> {
  const columns = loadoutColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));

  if (columns.length === 0) {
    throw new AppError(400, "No valid loadout fields provided");
  }

  const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
  const values = columns.map((column) => toSqlValue(data[column]));
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE \`USER_LOADOUT\` SET ${assignments} WHERE \`user_id\` = ? AND \`loadout_id\` = ?`,
    [...values, userId, loadoutId]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, "Loadout not found");
  }

  const nextLoadoutId = typeof data.loadout_id === "number" ? data.loadout_id : loadoutId;
  return getUserLoadout(userId, nextLoadoutId);
}

export async function deleteUserLoadout(userId: number, loadoutId: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM `USER_LOADOUT` WHERE `user_id` = ? AND `loadout_id` = ?",
    [userId, loadoutId]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, "Loadout not found");
  }
}
