import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import type { ClientSyncVersions, UserVersions } from "../types/db";

type VersionColumn =
  | "settings_version"
  | "generic_stats_version"
  | "play_stats_version"
  | "loadout_version"
  | "inventory_version";

type VersionSection = keyof ClientSyncVersions;
type UserVersionsRow = UserVersions & RowDataPacket;

const versionColumnsBySection: Record<VersionSection, VersionColumn> = {
  settings: "settings_version",
  genericStats: "generic_stats_version",
  playStats: "play_stats_version",
  loadout: "loadout_version",
  inventory: "inventory_version"
};

export function normalizeClientVersions(value: unknown): ClientSyncVersions {
  const source =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    settings: Number.isInteger(source.settings) ? Number(source.settings) : 0,
    genericStats: Number.isInteger(source.genericStats) ? Number(source.genericStats) : 0,
    playStats: Number.isInteger(source.playStats) ? Number(source.playStats) : 0,
    loadout: Number.isInteger(source.loadout) ? Number(source.loadout) : 0,
    inventory: Number.isInteger(source.inventory) ? Number(source.inventory) : 0
  };
}

export function toClientSyncVersions(versions: UserVersions): ClientSyncVersions {
  return {
    settings: versions.settings_version,
    genericStats: versions.generic_stats_version,
    playStats: versions.play_stats_version,
    loadout: versions.loadout_version,
    inventory: versions.inventory_version
  };
}

export function getStaleSyncSections(
  clientVersions: ClientSyncVersions,
  serverVersions: ClientSyncVersions
): VersionSection[] {
  return (Object.keys(serverVersions) as VersionSection[]).filter(
    (section) => clientVersions[section] !== serverVersions[section]
  );
}

export async function ensureUserVersions(
  userId: string,
  connection: PoolConnection = pool as unknown as PoolConnection
): Promise<void> {
  await connection.execute(
    "INSERT IGNORE INTO `user_versions` (`user_id`) VALUES (?)",
    [userId]
  );
}

export async function getUserVersions(
  userId: string,
  connection: PoolConnection = pool as unknown as PoolConnection
): Promise<UserVersions> {
  const [rows] = await connection.execute<UserVersionsRow[]>(
    "SELECT * FROM `user_versions` WHERE `user_id` = ? LIMIT 1",
    [userId]
  );

  return rows[0];
}

export async function incrementUserVersion(
  userId: string,
  section: VersionSection,
  connection: PoolConnection = pool as unknown as PoolConnection
): Promise<void> {
  await ensureUserVersions(userId, connection);
  const column = versionColumnsBySection[section];
  await connection.execute(
    `UPDATE \`user_versions\` SET \`${column}\` = \`${column}\` + 1 WHERE \`user_id\` = ?`,
    [userId]
  );
}

export async function setZeroVersionsToOne(
  userId: string,
  connection: PoolConnection
): Promise<void> {
  await connection.execute(
    "UPDATE `user_versions` SET `settings_version` = IF(`settings_version` = 0, 1, `settings_version`), `generic_stats_version` = IF(`generic_stats_version` = 0, 1, `generic_stats_version`), `play_stats_version` = IF(`play_stats_version` = 0, 1, `play_stats_version`), `loadout_version` = IF(`loadout_version` = 0, 1, `loadout_version`), `inventory_version` = IF(`inventory_version` = 0, 1, `inventory_version`) WHERE `user_id` = ?",
    [userId]
  );
}
