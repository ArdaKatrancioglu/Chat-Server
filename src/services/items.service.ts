import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { Melee, ThrowableItem, UserItem, Weapon } from "../types/db";
import { toSqlValue } from "../types/sql";

type UserItemRow = UserItem & RowDataPacket;
type WeaponRow = Weapon & RowDataPacket;
type MeleeRow = Melee & RowDataPacket;
type ThrowableRow = ThrowableItem & RowDataPacket;

const userItemColumns = ["item_id", "item_type", "acquired_at", "first_owner_id"];
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

function validateItemId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(400, "item_id must be an integer");
  }

  return value;
}

function insertSql(tableName: string, columns: string[]): string {
  const escapedColumns = columns.map((column) => `\`${column}\``).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  return `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${placeholders})`;
}

export async function listUserItems(userId: number): Promise<UserItem[]> {
  const [rows] = await pool.execute<UserItemRow[]>(
    "SELECT * FROM `USER_ITEM` WHERE `user_id` = ? ORDER BY `item_id`",
    [userId]
  );

  return rows;
}

export async function createUserItem(userId: number, data: Record<string, unknown>): Promise<UserItem> {
  const itemId = validateItemId(data.item_id);
  const values = userItemColumns.map((column) => toSqlValue(data[column]));

  await pool.execute(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, ?, ?, ?)",
    [userId, ...values]
  );

  const [rows] = await pool.execute<UserItemRow[]>(
    "SELECT * FROM `USER_ITEM` WHERE `user_id` = ? AND `item_id` = ? LIMIT 1",
    [userId, itemId]
  );

  return rows[0];
}

export async function deleteUserItem(userId: number, itemId: number): Promise<void> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM `USER_ITEM` WHERE `user_id` = ? AND `item_id` = ?",
    [userId, itemId]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, "User item not found");
  }
}

export async function listWeapons(): Promise<Weapon[]> {
  const [rows] = await pool.execute<WeaponRow[]>("SELECT * FROM `WEAPON` ORDER BY `item_id`");
  return rows;
}

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
    throw new AppError(404, "Weapon not found");
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
    throw new AppError(404, "Melee item not found");
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
    throw new AppError(404, "Throwable item not found");
  }

  return rows[0];
}
