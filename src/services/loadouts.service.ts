import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { HydratedUserLoadout, UserLoadout } from "../types/db";
import { toSqlValue } from "../types/sql";
import { getHydratedUserItem } from "./items.service";
import { incrementUserVersion } from "./versions.service";

type LoadoutRow = UserLoadout & RowDataPacket;

const loadoutColumns = [
  "loadout_id",
  "slot_index",
  "primary_gun_id",
  "secondary_gun_id",
  "knife_id",
  "throwable_id",
  "agent_id"
];

export async function listUserLoadouts(userId: string): Promise<UserLoadout[]> {
  const [rows] = await pool.execute<LoadoutRow[]>(
    "SELECT * FROM `USER_LOADOUT` WHERE `user_id` = ? ORDER BY `slot_index`, `loadout_id`",
    [userId]
  );

  return rows;
}

async function hydrateLoadout(loadout: UserLoadout): Promise<HydratedUserLoadout> {
  const hydrate = async (itemId: number | null) => {
    if (itemId === null) {
      return null;
    }

    try {
      return await getHydratedUserItem(loadout.user_id, itemId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  };

  const [primaryGun, secondaryGun, knife, throwable, agent] = await Promise.all([
    hydrate(loadout.primary_gun_id),
    hydrate(loadout.secondary_gun_id),
    hydrate(loadout.knife_id),
    hydrate(loadout.throwable_id),
    hydrate(loadout.agent_id)
  ]);

  return {
    ...loadout,
    primary_gun: primaryGun,
    secondary_gun: secondaryGun,
    knife,
    throwable,
    agent
  };
}

export async function listHydratedUserLoadouts(userId: string): Promise<HydratedUserLoadout[]> {
  const loadouts = await listUserLoadouts(userId);
  return Promise.all(loadouts.map((loadout) => hydrateLoadout(loadout)));
}

export async function getUserLoadout(userId: string, loadoutId: number): Promise<UserLoadout> {
  const [rows] = await pool.execute<LoadoutRow[]>(
    "SELECT * FROM `USER_LOADOUT` WHERE `user_id` = ? AND `loadout_id` = ? LIMIT 1",
    [userId, loadoutId]
  );

  if (!rows[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Loadout not found.");
  }

  return rows[0];
}

export async function createUserLoadout(
  userId: string,
  data: Record<string, unknown>
): Promise<UserLoadout> {
  if (typeof data.loadout_id !== "number" || !Number.isInteger(data.loadout_id)) {
    throw new AppError(400, "VALIDATION_ERROR", "loadout_id must be an integer", {
      details: { field: "loadout_id" }
    });
  }

  const values = loadoutColumns.map((column) => toSqlValue(data[column]));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO `USER_LOADOUT` (`user_id`, `loadout_id`, `slot_index`, `primary_gun_id`, `secondary_gun_id`, `knife_id`, `throwable_id`, `agent_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, ...values]
    );
    await incrementUserVersion(userId, "loadout", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getUserLoadout(userId, data.loadout_id);
}

export async function updateUserLoadout(
  userId: string,
  loadoutId: number,
  data: Record<string, unknown>
): Promise<UserLoadout> {
  const columns = loadoutColumns.filter((column) => Object.prototype.hasOwnProperty.call(data, column));

  if (columns.length === 0) {
    throw new AppError(400, "INVALID_REQUEST_BODY", "No valid loadout fields provided.", {
      details: { fields: loadoutColumns }
    });
  }

  const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
  const values = columns.map((column) => toSqlValue(data[column]));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE \`USER_LOADOUT\` SET ${assignments} WHERE \`user_id\` = ? AND \`loadout_id\` = ?`,
      [...values, userId, loadoutId]
    );

    if (result.affectedRows === 0) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Loadout not found.");
    }

    await incrementUserVersion(userId, "loadout", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const nextLoadoutId = typeof data.loadout_id === "number" ? data.loadout_id : loadoutId;
  return getUserLoadout(userId, nextLoadoutId);
}

export async function deleteUserLoadout(userId: string, loadoutId: number): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      "DELETE FROM `USER_LOADOUT` WHERE `user_id` = ? AND `loadout_id` = ?",
      [userId, loadoutId]
    );

    if (result.affectedRows === 0) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Loadout not found.");
    }

    await incrementUserVersion(userId, "loadout", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
