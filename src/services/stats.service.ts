import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { UserGenericStats, UserPlayStats } from "../types/db";
import { toSqlValue } from "../types/sql";
import { normalizeUtcDate, toUtcIsoString } from "../utils/time";
import { ensureUserVersions, incrementUserVersion } from "./versions.service";

type GenericStatsRow = UserGenericStats & RowDataPacket;
type PlayStatsRow = UserPlayStats & RowDataPacket;

const genericStatsColumns = ["created_at", "last_online", "xp"];
export const playStatsColumns = [
  "kills",
  "deaths",
  "wins",
  "losses",
  "damage_dealt",
  "damage_taken",
  "healing_done",
  "headshots",
  "shots_fired",
  "shots_hit",
  "playtime_seconds"
];

async function rowExists(
  tableName: string,
  userId: string,
  connection: PoolConnection = pool as unknown as PoolConnection
): Promise<boolean> {
  const [rows] = await connection.execute<RowDataPacket[]>(
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

export function selectGenericStatsPatchColumns(data: Record<string, unknown>): string[] {
  return genericStatsColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));
}

export function selectPlayStatsPatchColumns(data: Record<string, unknown>): string[] {
  return playStatsColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));
}

async function ensureUserRow(userId: string, connection: PoolConnection): Promise<void> {
  await connection.execute(
    "INSERT IGNORE INTO `USER` (`id`, `username`, `email`) VALUES (?, 'Player', NULL)",
    [userId]
  );
  await ensureUserVersions(userId, connection);
}

async function ensureGenericStatsRow(userId: string, connection: PoolConnection): Promise<void> {
  await ensureUserRow(userId, connection);
  await connection.execute(
    "INSERT IGNORE INTO `USER_GENERIC_STATS` (`user_id`, `created_at`, `last_online`, `xp`) VALUES (?, UTC_DATE(), UTC_TIMESTAMP(3), 0)",
    [userId]
  );
}

function toGenericStatsResponse(row: UserGenericStats): UserGenericStats {
  return {
    ...row,
    last_online: toUtcIsoString(row.last_online)
  };
}

function genericStatsValue(column: string, value: unknown) {
  if (column === "last_online" && value !== undefined && value !== null) {
    return normalizeUtcDate(value);
  }

  return toSqlValue(value);
}

async function ensurePlayStatsRow(userId: string, connection: PoolConnection): Promise<void> {
  await ensureUserRow(userId, connection);
  await connection.execute(
    "INSERT IGNORE INTO `USER_PLAY_STATS` (`user_id`, `kills`, `deaths`, `wins`, `losses`, `damage_dealt`, `damage_taken`, `healing_done`, `headshots`, `shots_fired`, `shots_hit`, `playtime_seconds`) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)",
    [userId]
  );
}

export async function getGenericStats(userId: string): Promise<UserGenericStats> {
  const [rows] = await pool.execute<GenericStatsRow[]>(
    "SELECT * FROM `USER_GENERIC_STATS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  if (!rows[0]) {
    throw new AppError(404, "Generic stats not found");
  }

  return toGenericStatsResponse(rows[0]);
}

export async function putGenericStats(
  userId: string,
  data: Record<string, unknown>
): Promise<UserGenericStats> {
  const values = genericStatsColumns.map((column) => genericStatsValue(column, data[column]));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (await rowExists("USER_GENERIC_STATS", userId, connection)) {
      await connection.execute(updateSql("USER_GENERIC_STATS", genericStatsColumns), [...values, userId]);
    } else {
      await connection.execute(insertSql("USER_GENERIC_STATS", genericStatsColumns), [userId, ...values]);
    }

    await incrementUserVersion(userId, "genericStats", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getGenericStats(userId);
}

export async function patchGenericStats(
  userId: string,
  data: Record<string, unknown>
): Promise<UserGenericStats> {
  const columns = selectGenericStatsPatchColumns(data);

  if (columns.length === 0) {
    throw new AppError(400, "No valid generic stats fields provided");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureGenericStatsRow(userId, connection);
    const [result] = await connection.execute<ResultSetHeader>(updateSql("USER_GENERIC_STATS", columns), [
      ...columns.map((column) => genericStatsValue(column, data[column])),
      userId
    ]);

    if (result.affectedRows === 0) {
      throw new AppError(404, "Generic stats not found");
    }

    await incrementUserVersion(userId, "genericStats", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (await rowExists("USER_PLAY_STATS", userId, connection)) {
      await connection.execute(updateSql("USER_PLAY_STATS", playStatsColumns), [...values, userId]);
    } else {
      await connection.execute(insertSql("USER_PLAY_STATS", playStatsColumns), [userId, ...values]);
    }

    await incrementUserVersion(userId, "playStats", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getPlayStats(userId);
}

export async function patchPlayStats(userId: string, data: Record<string, unknown>): Promise<UserPlayStats> {
  const columns = selectPlayStatsPatchColumns(data);

  if (columns.length === 0) {
    throw new AppError(400, "No valid play stats fields provided");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensurePlayStatsRow(userId, connection);
    const [result] = await connection.execute<ResultSetHeader>(updateSql("USER_PLAY_STATS", columns), [
      ...columns.map((column) => toSqlValue(data[column])),
      userId
    ]);

    if (result.affectedRows === 0) {
      throw new AppError(404, "Play stats not found");
    }

    await incrementUserVersion(userId, "playStats", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getPlayStats(userId);
}
