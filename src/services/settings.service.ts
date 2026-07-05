import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import { incrementUserVersion } from "./versions.service";

interface UserSettingsRow extends RowDataPacket {
  user_id: string;
  settings: unknown;
}

function toJsonValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

async function settingsExist(
  userId: string,
  connection: PoolConnection = pool as unknown as PoolConnection
): Promise<boolean> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT 1 FROM `USER_SETTINGS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  return rows.length > 0;
}

export async function getUserSettings(userId: string): Promise<UserSettingsRow> {
  const [rows] = await pool.execute<UserSettingsRow[]>(
    "SELECT * FROM `USER_SETTINGS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  if (!rows[0]) {
    throw new AppError(404, "User settings not found");
  }

  return rows[0];
}

export async function putUserSettings(
  userId: string,
  data: Record<string, unknown>
): Promise<UserSettingsRow> {
  const settings = toJsonValue(data.settings);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (await settingsExist(userId, connection)) {
      await connection.execute("UPDATE `USER_SETTINGS` SET `settings` = ? WHERE `user_id` = ?", [
        settings,
        userId
      ]);
    } else {
      await connection.execute("INSERT INTO `USER_SETTINGS` (`user_id`, `settings`) VALUES (?, ?)", [
        userId,
        settings
      ]);
    }

    await incrementUserVersion(userId, "settings", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getUserSettings(userId);
}
