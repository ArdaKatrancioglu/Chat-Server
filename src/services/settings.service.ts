import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";

interface UserSettingsRow extends RowDataPacket {
  user_id: number;
  settings: unknown;
}

function toJsonValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

async function settingsExist(userId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM `USER_SETTINGS` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  return rows.length > 0;
}

export async function getUserSettings(userId: number): Promise<UserSettingsRow> {
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
  userId: number,
  data: Record<string, unknown>
): Promise<UserSettingsRow> {
  const settings = toJsonValue(data.settings);

  if (await settingsExist(userId)) {
    await pool.execute("UPDATE `USER_SETTINGS` SET `settings` = ? WHERE `user_id` = ?", [
      settings,
      userId
    ]);
  } else {
    await pool.execute("INSERT INTO `USER_SETTINGS` (`user_id`, `settings`) VALUES (?, ?)", [
      userId,
      settings
    ]);
  }

  return getUserSettings(userId);
}
