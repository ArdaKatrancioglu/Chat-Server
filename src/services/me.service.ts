import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import { listHydratedUserItems } from "./items.service";
import { listHydratedUserLoadouts } from "./loadouts.service";
import { getUserSettings } from "./settings.service";
import { getGenericStats, getPlayStats } from "./stats.service";
import { getUserById } from "./users.service";

export async function ensureUserSynced(userId: string): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM `USER` WHERE `id` = ? LIMIT 1", [
    userId
  ]);

  if (rows.length === 0) {
    throw new AppError(404, "User not synced. Call POST /auth/sync first.");
  }
}

export async function getMeProfile(userId: string) {
  await ensureUserSynced(userId);

  const [user, settings, genericStats, playStats, loadouts, items] = await Promise.all([
    getUserById(userId),
    getUserSettings(userId),
    getGenericStats(userId),
    getPlayStats(userId),
    listHydratedUserLoadouts(userId),
    listHydratedUserItems(userId)
  ]);

  return {
    user,
    settings,
    genericStats,
    playStats,
    loadouts,
    items
  };
}
