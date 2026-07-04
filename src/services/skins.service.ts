import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { Skin } from "../types/db";
import { toSqlValue } from "../types/sql";

type SkinRow = Skin & RowDataPacket;

const skinColumns = ["skin_id", "material_name", "finish_name"];

export async function listSkins(): Promise<Skin[]> {
  const [rows] = await pool.execute<SkinRow[]>("SELECT * FROM `SKIN` ORDER BY `skin_id`");
  return rows;
}

export async function createSkin(data: Record<string, unknown>): Promise<Skin> {
  if (typeof data.skin_id !== "number" || !Number.isInteger(data.skin_id)) {
    throw new AppError(400, "skin_id must be an integer");
  }

  await pool.execute(
    "INSERT INTO `SKIN` (`skin_id`, `material_name`, `finish_name`) VALUES (?, ?, ?)",
    skinColumns.map((column) => toSqlValue(data[column]))
  );

  return getSkinById(data.skin_id);
}

export async function getSkinById(skinId: number): Promise<Skin> {
  const [rows] = await pool.execute<SkinRow[]>("SELECT * FROM `SKIN` WHERE `skin_id` = ? LIMIT 1", [
    skinId
  ]);

  if (!rows[0]) {
    throw new AppError(404, "Skin not found");
  }

  return rows[0];
}
