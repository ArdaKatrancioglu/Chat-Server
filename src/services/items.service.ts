import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { Agent, HydratedUserItem, Melee, ThrowableItem, UserItem, Weapon } from "../types/db";
import {
  ITEM_TYPE_AGENT,
  ITEM_TYPE_MELEE,
  ITEM_TYPE_THROWABLE,
  ITEM_TYPE_WEAPON,
  itemTypeCodeToName,
  parseItemType
} from "../types/itemTypes";
import { toSqlValue } from "../types/sql";
import { normalizeUtcDate, toUtcIsoString } from "../utils/time";
import { ensureUserVersions, incrementUserVersion } from "./versions.service";

type UserItemRow = UserItem & RowDataPacket;
type WeaponRow = Weapon & RowDataPacket;
type MeleeRow = Melee & RowDataPacket;
type ThrowableRow = ThrowableItem & RowDataPacket;
type AgentRow = Agent & RowDataPacket;

const weaponColumns = [
  "item_id",
  "weapon_id",
  "skin_id",
  "description",
  "pattern_x",
  "pattern_y",
  "pattern_z"
];
const meleeColumns = [
  "item_id",
  "melee_id",
  "skin_id",
  "description",
  "pattern_x",
  "pattern_y",
  "pattern_z"
];
const throwableColumns = ["item_id", "throwable_id", "description"];
const agentColumns = ["item_id", "agent_id", "description"];

function validateItemId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(400, "VALIDATION_ERROR", "item_id must be an integer", {
      details: { field: "item_id" }
    });
  }

  return value;
}

function validateNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${fieldName} must be a number`, {
      details: { field: fieldName }
    });
  }

  return value;
}

function validateOptionalItemId(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  return validateItemId(value);
}

function detailsObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(400, "INVALID_ITEM_DETAILS", "details must be an object", {
      details: { field: "details" }
    });
  }

  return value as Record<string, unknown>;
}

export function validateTypedItemPayload(data: Record<string, unknown>): {
  itemType: number;
  details: Record<string, unknown>;
} {
  const itemType = parseItemType(data.item_type);

  if (itemType === null) {
    throw new AppError(
      400,
      "INVALID_ITEM_TYPE",
      "item_type must be one of weapon, melee, throwable, or agent",
      { details: { field: "item_type" } }
    );
  }

  const details = detailsObject(data.details);

  if (itemType === ITEM_TYPE_WEAPON) {
    if (typeof details.weapon_id !== "string" || details.weapon_id.trim() === "") {
      throw new AppError(400, "MISSING_REQUIRED_FIELD", "details.weapon_id is required", {
        details: { field: "details.weapon_id" }
      });
    }
    validateNumber(details.skin_id, "details.skin_id");
    validateNumber(details.pattern_x, "details.pattern_x");
    validateNumber(details.pattern_y, "details.pattern_y");
    validateNumber(details.pattern_z, "details.pattern_z");
  }

  if (itemType === ITEM_TYPE_MELEE) {
    if (typeof details.melee_id !== "string" || details.melee_id.trim() === "") {
      throw new AppError(400, "MISSING_REQUIRED_FIELD", "details.melee_id is required", {
        details: { field: "details.melee_id" }
      });
    }
    validateNumber(details.skin_id, "details.skin_id");
    validateNumber(details.pattern_x, "details.pattern_x");
    validateNumber(details.pattern_y, "details.pattern_y");
    validateNumber(details.pattern_z, "details.pattern_z");
  }

  if (itemType === ITEM_TYPE_THROWABLE) {
    if (typeof details.throwable_id !== "string" || details.throwable_id.trim() === "") {
      throw new AppError(400, "MISSING_REQUIRED_FIELD", "details.throwable_id is required", {
        details: { field: "details.throwable_id" }
      });
    }
  }

  if (itemType === ITEM_TYPE_AGENT) {
    if (typeof details.agent_id !== "string" || details.agent_id.trim() === "") {
      throw new AppError(400, "MISSING_REQUIRED_FIELD", "details.agent_id is required", {
        details: { field: "details.agent_id" }
      });
    }
  }

  return { itemType, details };
}

function insertSql(tableName: string, columns: string[]): string {
  const escapedColumns = columns.map((column) => `\`${column}\``).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  return `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${placeholders})`;
}

function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

async function ensureUserRow(userId: string, connection: PoolConnection): Promise<void> {
  await connection.execute(
    "INSERT IGNORE INTO `USER` (`id`, `username`, `email`) VALUES (?, 'Player', NULL)",
    [userId]
  );
  await ensureUserVersions(userId, connection);
}

export async function listUserItems(userId: string): Promise<UserItem[]> {
  const [rows] = await pool.execute<UserItemRow[]>(
    "SELECT * FROM `USER_ITEM` WHERE `user_id` = ? ORDER BY `item_id`",
    [userId]
  );

  return rows;
}

function hydrateItem(row: UserItemRow & WeaponRow & MeleeRow & ThrowableRow & AgentRow): HydratedUserItem {
  const base = {
    user_id: row.user_id,
    item_id: row.item_id,
    item_type: itemTypeCodeToName(row.item_type),
    acquired_at: toUtcIsoString(row.acquired_at),
    first_owner_id: row.first_owner_id
  };

  if (row.weapon_item_id !== null) {
    return {
      ...base,
      kind: "weapon",
      details: {
        item_id: row.weapon_item_id,
        weapon_id: row.weapon_id,
        skin_id: row.weapon_skin_id,
        description: row.weapon_description,
        pattern_x: Number(row.weapon_pattern_x),
        pattern_y: Number(row.weapon_pattern_y),
        pattern_z: Number(row.weapon_pattern_z)
      }
    };
  }

  if (row.melee_item_id !== null) {
    return {
      ...base,
      kind: "melee",
      details: {
        item_id: row.melee_item_id,
        melee_id: row.melee_id,
        skin_id: row.melee_skin_id,
        description: row.melee_description,
        pattern_x: Number(row.melee_pattern_x),
        pattern_y: Number(row.melee_pattern_y),
        pattern_z: Number(row.melee_pattern_z)
      }
    };
  }

  if (row.throwable_item_id !== null) {
    return {
      ...base,
      kind: "throwable",
      details: {
        item_id: row.throwable_item_id,
        throwable_id: row.throwable_id,
        description: row.throwable_description
      }
    };
  }

  if (row.agent_item_id !== null) {
    return {
      ...base,
      kind: "agent",
      details: {
        item_id: row.agent_item_id,
        agent_id: row.agent_code,
        description: row.agent_description
      }
    };
  }

  return {
    ...base,
    kind: "unknown",
    details: null
  };
}

async function selectHydratedUserItems(userId: string, itemId?: number): Promise<HydratedUserItem[]> {
  const itemFilter = itemId === undefined ? "" : "AND `USER_ITEM`.`item_id` = ?";
  const values = itemId === undefined ? [userId] : [userId, itemId];
  const [rows] = await pool.execute<Array<UserItemRow & RowDataPacket>>(
    `SELECT
      \`USER_ITEM\`.\`user_id\`,
      \`USER_ITEM\`.\`item_id\`,
      \`USER_ITEM\`.\`item_type\`,
      \`USER_ITEM\`.\`acquired_at\`,
      \`USER_ITEM\`.\`first_owner_id\`,
      \`WEAPON\`.\`item_id\` AS \`weapon_item_id\`,
      \`WEAPON\`.\`weapon_id\`,
      \`WEAPON\`.\`skin_id\` AS \`weapon_skin_id\`,
      \`WEAPON\`.\`description\` AS \`weapon_description\`,
      \`WEAPON\`.\`pattern_x\` AS \`weapon_pattern_x\`,
      \`WEAPON\`.\`pattern_y\` AS \`weapon_pattern_y\`,
      \`WEAPON\`.\`pattern_z\` AS \`weapon_pattern_z\`,
      \`MELEE\`.\`item_id\` AS \`melee_item_id\`,
      \`MELEE\`.\`melee_id\`,
      \`MELEE\`.\`skin_id\` AS \`melee_skin_id\`,
      \`MELEE\`.\`description\` AS \`melee_description\`,
      \`MELEE\`.\`pattern_x\` AS \`melee_pattern_x\`,
      \`MELEE\`.\`pattern_y\` AS \`melee_pattern_y\`,
      \`MELEE\`.\`pattern_z\` AS \`melee_pattern_z\`,
      \`THROWABLE\`.\`item_id\` AS \`throwable_item_id\`,
      \`THROWABLE\`.\`throwable_id\`,
      \`THROWABLE\`.\`description\` AS \`throwable_description\`,
      \`AGENT\`.\`item_id\` AS \`agent_item_id\`,
      \`AGENT\`.\`agent_id\` AS \`agent_code\`,
      \`AGENT\`.\`description\` AS \`agent_description\`
    FROM \`USER_ITEM\`
    LEFT JOIN \`WEAPON\` ON \`WEAPON\`.\`item_id\` = \`USER_ITEM\`.\`item_id\`
    LEFT JOIN \`MELEE\` ON \`MELEE\`.\`item_id\` = \`USER_ITEM\`.\`item_id\`
    LEFT JOIN \`THROWABLE\` ON \`THROWABLE\`.\`item_id\` = \`USER_ITEM\`.\`item_id\`
    LEFT JOIN \`AGENT\` ON \`AGENT\`.\`item_id\` = \`USER_ITEM\`.\`item_id\`
    WHERE \`USER_ITEM\`.\`user_id\` = ? ${itemFilter}
    ORDER BY \`USER_ITEM\`.\`item_id\``,
    values
  );

  return rows.map((row) => hydrateItem(row as UserItemRow & WeaponRow & MeleeRow & ThrowableRow & AgentRow));
}

export async function listHydratedUserItems(userId: string): Promise<HydratedUserItem[]> {
  return selectHydratedUserItems(userId);
}

export async function getHydratedUserItem(userId: string, itemId: number): Promise<HydratedUserItem> {
  const items = await selectHydratedUserItems(userId, itemId);

  if (!items[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "User item not found.");
  }

  return items[0];
}

export async function createUserItem(userId: string, data: Record<string, unknown>): Promise<UserItem> {
  let itemId: number;
  const connection = await pool.getConnection();
  const parsedItemType = parseItemType(data.item_type);

  try {
    await connection.beginTransaction();
    await ensureUserRow(userId, connection);

    if (data.item_id === undefined || data.item_id === null) {
      const [result] = await connection.execute<ResultSetHeader>(
          "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, COALESCE(?, CURRENT_DATE()), ?)",
        [
          userId,
          toSqlValue(parsedItemType ?? data.item_type),
          toSqlValue(data.acquired_at),
          toSqlValue(data.first_owner_id ?? userId)
        ]
      );
      itemId = result.insertId;
    } else {
      itemId = validateItemId(data.item_id);

      await connection.execute(
        "INSERT INTO `USER_ITEM` (`user_id`, `item_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, ?, COALESCE(?, CURRENT_DATE()), ?)",
        [
          userId,
          itemId,
          toSqlValue(parsedItemType ?? data.item_type),
          toSqlValue(data.acquired_at),
          toSqlValue(data.first_owner_id ?? userId)
        ]
      );
    }

    await incrementUserVersion(userId, "inventory", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntryError(error)) {
      throw new AppError(409, "DUPLICATE_RESOURCE", "User item already exists.");
    }
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.execute<UserItemRow[]>(
    "SELECT * FROM `USER_ITEM` WHERE `user_id` = ? AND `item_id` = ? LIMIT 1",
    [userId, itemId]
  );

  return rows[0];
}

export async function createTypedUserItem(
  userId: string,
  data: Record<string, unknown>
): Promise<HydratedUserItem> {
  const { itemType, details } = validateTypedItemPayload(data);
  const itemId = validateOptionalItemId(data.item_id);
  const acquiredAt = data.acquired_at === undefined ? null : normalizeUtcDate(data.acquired_at);
  const firstOwnerId = typeof data.first_owner_id === "string" && data.first_owner_id.trim() !== ""
    ? data.first_owner_id
    : userId;
  const connection = await pool.getConnection();
  let createdItemId = 0;

  try {
    await connection.beginTransaction();
    await ensureUserRow(userId, connection);

    if (itemId === null) {
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, COALESCE(?, UTC_TIMESTAMP(3)), ?)",
        [userId, itemType, acquiredAt, firstOwnerId]
      );
      createdItemId = result.insertId;
    } else {
      await connection.execute(
        "INSERT INTO `USER_ITEM` (`user_id`, `item_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, ?, COALESCE(?, UTC_TIMESTAMP(3)), ?)",
        [userId, itemId, itemType, acquiredAt, firstOwnerId]
      );
      createdItemId = itemId;
    }

    if (itemType === ITEM_TYPE_WEAPON) {
      await connection.execute(
        "INSERT INTO `WEAPON` (`item_id`, `weapon_id`, `skin_id`, `description`, `pattern_x`, `pattern_y`, `pattern_z`) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          createdItemId,
          toSqlValue(details.weapon_id),
          toSqlValue(details.skin_id),
          toSqlValue(details.description),
          toSqlValue(details.pattern_x),
          toSqlValue(details.pattern_y),
          toSqlValue(details.pattern_z)
        ]
      );
    }

    if (itemType === ITEM_TYPE_MELEE) {
      await connection.execute(
        "INSERT INTO `MELEE` (`item_id`, `melee_id`, `skin_id`, `description`, `pattern_x`, `pattern_y`, `pattern_z`) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          createdItemId,
          toSqlValue(details.melee_id),
          toSqlValue(details.skin_id),
          toSqlValue(details.description),
          toSqlValue(details.pattern_x),
          toSqlValue(details.pattern_y),
          toSqlValue(details.pattern_z)
        ]
      );
    }

    if (itemType === ITEM_TYPE_THROWABLE) {
      await connection.execute(
        "INSERT INTO `THROWABLE` (`item_id`, `throwable_id`, `description`) VALUES (?, ?, ?)",
        [createdItemId, toSqlValue(details.throwable_id), toSqlValue(details.description)]
      );
    }

    if (itemType === ITEM_TYPE_AGENT) {
      await connection.execute(
        "INSERT INTO `AGENT` (`item_id`, `agent_id`, `description`) VALUES (?, ?, ?)",
        [createdItemId, toSqlValue(details.agent_id), toSqlValue(details.description)]
      );
    }

    await incrementUserVersion(userId, "inventory", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntryError(error)) {
      throw new AppError(409, "DUPLICATE_RESOURCE", "User item already exists.");
    }
    throw error;
  } finally {
    connection.release();
  }

  return getHydratedUserItem(userId, createdItemId);
}

export async function deleteUserItem(userId: string, itemId: number): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [items] = await connection.execute<UserItemRow[]>(
      "SELECT * FROM `USER_ITEM` WHERE `user_id` = ? AND `item_id` = ? LIMIT 1",
      [userId, itemId]
    );

    if (!items[0]) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "User item not found.");
    }

    await connection.execute("DELETE FROM `WEAPON` WHERE `item_id` = ?", [itemId]);
    await connection.execute("DELETE FROM `MELEE` WHERE `item_id` = ?", [itemId]);
    await connection.execute("DELETE FROM `THROWABLE` WHERE `item_id` = ?", [itemId]);
    await connection.execute("DELETE FROM `AGENT` WHERE `item_id` = ?", [itemId]);

    const [result] = await connection.execute<ResultSetHeader>(
      "DELETE FROM `USER_ITEM` WHERE `user_id` = ? AND `item_id` = ?",
      [userId, itemId]
    );

    if (result.affectedRows === 0) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "User item not found.");
    }

    await incrementUserVersion(userId, "inventory", connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listWeapons(): Promise<Weapon[]> {
  const [rows] = await pool.execute<WeaponRow[]>("SELECT * FROM `WEAPON` ORDER BY `item_id`");
  return rows;
}

export async function listAgents(): Promise<Agent[]> {
  const [rows] = await pool.execute<AgentRow[]>("SELECT * FROM `AGENT` ORDER BY `item_id`");
  return rows;
}

export async function createAgent(data: Record<string, unknown>): Promise<Agent> {
  const itemId = validateItemId(data.item_id);
  await pool.execute(insertSql("AGENT", agentColumns), agentColumns.map((column) => toSqlValue(data[column])));
  return getAgentByItemId(itemId);
}

export async function getAgentByItemId(itemId: number): Promise<Agent> {
  const [rows] = await pool.execute<AgentRow[]>("SELECT * FROM `AGENT` WHERE `item_id` = ? LIMIT 1", [
    itemId
  ]);

  if (!rows[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Agent not found.");
  }

  return rows[0];
}

export const itemTypes = {
  weapon: ITEM_TYPE_WEAPON,
  melee: ITEM_TYPE_MELEE,
  throwable: ITEM_TYPE_THROWABLE,
  agent: ITEM_TYPE_AGENT
};

export async function createWeapon(data: Record<string, unknown>): Promise<Weapon> {
  const itemId = validateItemId(data.item_id);
  await pool.execute(insertSql("WEAPON", weaponColumns), weaponColumns.map((column) => toSqlValue(data[column])));
  return getWeaponByItemId(itemId);
}

export async function getWeaponByItemId(itemId: number): Promise<Weapon> {
  const [rows] = await pool.execute<WeaponRow[]>("SELECT * FROM `WEAPON` WHERE `item_id` = ? LIMIT 1", [
    itemId
  ]);

  if (!rows[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Weapon not found.");
  }

  return rows[0];
}

export async function listMelee(): Promise<Melee[]> {
  const [rows] = await pool.execute<MeleeRow[]>("SELECT * FROM `MELEE` ORDER BY `item_id`");
  return rows;
}

export async function createMelee(data: Record<string, unknown>): Promise<Melee> {
  const itemId = validateItemId(data.item_id);
  await pool.execute(insertSql("MELEE", meleeColumns), meleeColumns.map((column) => toSqlValue(data[column])));
  return getMeleeByItemId(itemId);
}

export async function getMeleeByItemId(itemId: number): Promise<Melee> {
  const [rows] = await pool.execute<MeleeRow[]>("SELECT * FROM `MELEE` WHERE `item_id` = ? LIMIT 1", [
    itemId
  ]);

  if (!rows[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Melee item not found.");
  }

  return rows[0];
}

export async function listThrowables(): Promise<ThrowableItem[]> {
  const [rows] = await pool.execute<ThrowableRow[]>("SELECT * FROM `THROWABLE` ORDER BY `item_id`");
  return rows;
}

export async function createThrowable(data: Record<string, unknown>): Promise<ThrowableItem> {
  const itemId = validateItemId(data.item_id);
  await pool.execute(
    insertSql("THROWABLE", throwableColumns),
    throwableColumns.map((column) => toSqlValue(data[column]))
  );
  return getThrowableByItemId(itemId);
}

export async function getThrowableByItemId(itemId: number): Promise<ThrowableItem> {
  const [rows] = await pool.execute<ThrowableRow[]>(
    "SELECT * FROM `THROWABLE` WHERE `item_id` = ? LIMIT 1",
    [itemId]
  );

  if (!rows[0]) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Throwable item not found.");
  }

  return rows[0];
}
