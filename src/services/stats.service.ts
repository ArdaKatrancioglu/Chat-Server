import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { UserGenericStats, UserPlayStats } from "../types/db";
import { toSqlValue } from "../types/sql";

type GenericStatsRow = UserGenericStats & RowDataPacket;
type PlayStatsRow = UserPlayStats & RowDataPacket;

const genericStatsColumns = ["created_at", "last_online", "xp"];
export const playStatsColumns = [
  "kills",
  "deaths",
  "matches_played",
  "wins",
  "losses",
  "damage_dealt",
  "damage_taken",
  "healing_done",
  "headshots",
  "headshot_rate",
  "shots_fired",
  "shots_hit",
  "playtime_seconds"
];

async function rowExists(tableName: string, userId: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM \`${tableName}\` WHERE \`user_id\` = ? LIMIT 1`,
    [userId]
  );

  return rows.length > 0;
}

function insertSql(tableName: string, columns: string[]): string {
  const escapedColumns = ["user_id", ...columns].map((column) => `\`${column}\``).join(", ");
  const placeholders = ["user_id", ...columns].map(() => "?").join(", ");
  return `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${placeholders})`;
}

function updateSql(tableName: string, columns: string[]): string {
  const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
  return `UPDATE \`${tableName}\` SET ${assignments} WHERE \`user_id\` = ?`;
}

export async function getGenericStats(userId: string): Promise<UserGenericStats> {
  const [rows] = await pool.execute<GenericStatsRow[]>(
    "SELECT * FROM `USER_GENERIC_STATS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  if (!rows[0]) {
    throw new AppError(404, "Generic stats not found");
  }

  return rows[0];
}

export async function putGenericStats(
  userId: string,
  data: Record<string, unknown>
): Promise<UserGenericStats> {
  const values = genericStatsColumns.map((column) => toSqlValue(data[column]));

  if (await rowExists("USER_GENERIC_STATS", userId)) {
    await pool.execute(updateSql("USER_GENERIC_STATS", genericStatsColumns), [...values, userId]);
  } else {
    await pool.execute(insertSql("USER_GENERIC_STATS", genericStatsColumns), [userId, ...values]);
  }

  return getGenericStats(userId);
}

export async function getPlayStats(userId: string): Promise<UserPlayStats> {
  const [rows] = await pool.execute<PlayStatsRow[]>(
    "SELECT * FROM `USER_PLAY_STATS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  if (!rows[0]) {
    throw new AppError(404, "Play stats not found");
  }

  return rows[0];
}

export async function putPlayStats(userId: string, data: Record<string, unknown>): Promise<UserPlayStats> {
  const values = playStatsColumns.map((column) => toSqlValue(data[column]));

  if (await rowExists("USER_PLAY_STATS", userId)) {
    await pool.execute(updateSql("USER_PLAY_STATS", playStatsColumns), [...values, userId]);
  } else {
    await pool.execute(insertSql("USER_PLAY_STATS", playStatsColumns), [userId, ...values]);
  }

  return getPlayStats(userId);
}

export async function patchPlayStats(userId: string, data: Record<string, unknown>): Promise<UserPlayStats> {
  const columns = playStatsColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));

  if (columns.length === 0) {
    throw new AppError(400, "No valid play stats fields provided");
  }

  const [result] = await pool.execute<ResultSetHeader>(updateSql("USER_PLAY_STATS", columns), [
    ...columns.map((column) => toSqlValue(data[column])),
    userId
  ]);

  if (result.affectedRows === 0) {
    throw new AppError(404, "Play stats not found");
  }

  return getPlayStats(userId);
}
