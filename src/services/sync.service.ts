import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../middleware/errorHandler";
import type { ClientSyncVersions } from "../types/db";
import {
  ITEM_TYPE_AGENT,
  ITEM_TYPE_MELEE,
  ITEM_TYPE_THROWABLE,
  ITEM_TYPE_WEAPON
} from "../types/itemTypes";
import { listHydratedUserItems } from "./items.service";
import { listHydratedUserLoadouts } from "./loadouts.service";
import { getUserSettings } from "./settings.service";
import { getGenericStats, getPlayStats } from "./stats.service";
import { getUserById } from "./users.service";
import {
  ensureUserVersions,
  getStaleSyncSections,
  getUserVersions,
  incrementUserVersion,
  normalizeClientVersions,
  setZeroVersionsToOne,
  toClientSyncVersions
} from "./versions.service";

interface DefaultWeaponTemplate {
  weaponId: string;
  description: string;
}

interface DefaultMeleeTemplate {
  meleeId: string;
  description: string;
}

interface DefaultThrowableTemplate {
  throwableId: string;
  description: string;
}

interface DefaultAgentTemplate {
  agentId: string;
  description: string;
}

interface EnsuredItem {
  itemId: number;
  created: boolean;
}

const defaultWeapons: DefaultWeaponTemplate[] = [
  {
    weaponId: "45 ACP",
    description: "Free starter pistol with no standout strengths."
  },
  {
    weaponId: "Revolver",
    description: "Faster sidearm with slightly lower damage than the Deagle."
  },
  {
    weaponId: "Baretta 93R",
    description: "Three-round burst pistol that performs well up close."
  },
  {
    weaponId: "Deagle",
    description: "Very high damage pistol with heavy recoil."
  },
  {
    weaponId: "PT-9M",
    description: "Fast, balanced upgrade after the 45 ACP."
  },
  {
    weaponId: "M4A1",
    description: "Classic automatic rifle with balanced all-around performance."
  },
  {
    weaponId: "P40",
    description: "Semi-automatic rifle similar to the Guardian."
  },
  {
    weaponId: "Remington",
    description: "Fast pump shotgun that is powerful up close and weak at range."
  },
  {
    weaponId: "Futuristic AK",
    description: "Slow automatic rifle with high damage and blue futuristic styling."
  },
  {
    weaponId: "uzi",
    description: "Very fast compact SMG that loses effectiveness at range."
  },
  {
    weaponId: "UTS-15",
    description: "Automatic shotgun with lower damage and heavy recoil after the third shot."
  },
  {
    weaponId: "AWM",
    description: "High-damage sniper rifle designed for decisive long-range hits."
  },
  {
    weaponId: "M4A4_Changable",
    description: "Stronger M4A1 upgrade with controllable recoil and higher damage."
  }
];

const defaultMelee: DefaultMeleeTemplate = {
  meleeId: "Default CT",
  description: "Basic knife for close combat"
};

const defaultThrowables: DefaultThrowableTemplate[] = [
  {
    throwableId: "grenade",
    description: "Basic grenade that goes boom"
  },
  {
    throwableId: "impact-grenade",
    description: "Grenade that explodes when it impacts anything, including the player"
  }
];

const defaultAgent: DefaultAgentTemplate = {
  agentId: "default",
  description: "Default playable agent"
};

function bodyString(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function requireDefaultItemId(value: number | undefined, label: string): number {
  if (value === undefined) {
    throw new AppError(
      500,
      "INTERNAL_SERVER_ERROR",
      `Default sync item missing: ${label}`
    );
  }

  return value;
}

export function shouldFillDefaultLoadout(loadout: {
  primary_gun_id: number | null;
  secondary_gun_id: number | null;
  knife_id: number | null;
  throwable_id: number | null;
  agent_id: number | null;
}): boolean {
  return (
    loadout.primary_gun_id === null ||
    loadout.secondary_gun_id === null ||
    loadout.knife_id === null ||
    loadout.throwable_id === null ||
    loadout.agent_id === null
  );
}

export function buildUserNotRegisteredError(userId: string, email?: string | null): AppError {
  return new AppError(
    409,
    "USER_NOT_REGISTERED",
    "Authenticated Firebase user does not exist in the backend database. Create the user first, then call /auth/sync again.",
    {
      requiredAction: "CREATE_USER",
      details: {
        user: {
          id: userId,
          email: email ?? null
        }
      }
    }
  );
}

async function ensureRegisteredUser(connection: PoolConnection, userId: string, email?: string | null) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT * FROM `USER` WHERE `id` = ? LIMIT 1 FOR UPDATE",
    [userId]
  );

  if (rows.length === 0) {
    throw buildUserNotRegisteredError(userId, email);
  }
}

async function ensureDefaultWeapon(
  connection: PoolConnection,
  userId: string,
  weapon: DefaultWeaponTemplate
): Promise<EnsuredItem> {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    "SELECT `USER_ITEM`.`item_id` FROM `USER_ITEM` INNER JOIN `WEAPON` ON `WEAPON`.`item_id` = `USER_ITEM`.`item_id` WHERE `USER_ITEM`.`user_id` = ? AND `WEAPON`.`weapon_id` = ? LIMIT 1 FOR UPDATE",
    [userId, weapon.weaponId]
  );

  if (existingRows.length > 0) {
    const itemId = Number(existingRows[0].item_id);
    const [updateResult] = await connection.execute<ResultSetHeader>(
      "UPDATE `WEAPON` SET `skin_id` = -1 WHERE `item_id` = ? AND `skin_id` = 0",
      [itemId]
    );
    return { itemId, created: updateResult.affectedRows > 0 };
  }

  const [itemResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, UTC_TIMESTAMP(3), ?)",
    [userId, ITEM_TYPE_WEAPON, userId]
  );

  await connection.execute(
    "INSERT INTO `WEAPON` (`item_id`, `weapon_id`, `skin_id`, `description`, `pattern_x`, `pattern_y`, `pattern_z`) VALUES (?, ?, -1, ?, 0, 0, 0)",
    [itemResult.insertId, weapon.weaponId, weapon.description]
  );

  return { itemId: itemResult.insertId, created: true };
}

async function ensureDefaultMelee(
  connection: PoolConnection,
  userId: string,
  melee: DefaultMeleeTemplate
): Promise<EnsuredItem> {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    "SELECT `USER_ITEM`.`item_id` FROM `USER_ITEM` INNER JOIN `MELEE` ON `MELEE`.`item_id` = `USER_ITEM`.`item_id` WHERE `USER_ITEM`.`user_id` = ? AND `MELEE`.`melee_id` = ? LIMIT 1 FOR UPDATE",
    [userId, melee.meleeId]
  );

  if (existingRows.length > 0) {
    const itemId = Number(existingRows[0].item_id);
    const [updateResult] = await connection.execute<ResultSetHeader>(
      "UPDATE `MELEE` SET `skin_id` = -1 WHERE `item_id` = ? AND `skin_id` = 0",
      [itemId]
    );
    return { itemId, created: updateResult.affectedRows > 0 };
  }

  const [itemResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, UTC_TIMESTAMP(3), ?)",
    [userId, ITEM_TYPE_MELEE, userId]
  );

  await connection.execute(
    "INSERT INTO `MELEE` (`item_id`, `melee_id`, `skin_id`, `description`, `pattern_x`, `pattern_y`, `pattern_z`) VALUES (?, ?, -1, ?, 0, 0, 0)",
    [itemResult.insertId, melee.meleeId, melee.description]
  );

  return { itemId: itemResult.insertId, created: true };
}

async function ensureDefaultThrowable(
  connection: PoolConnection,
  userId: string,
  throwable: DefaultThrowableTemplate
): Promise<EnsuredItem> {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    "SELECT `USER_ITEM`.`item_id` FROM `USER_ITEM` INNER JOIN `THROWABLE` ON `THROWABLE`.`item_id` = `USER_ITEM`.`item_id` WHERE `USER_ITEM`.`user_id` = ? AND `THROWABLE`.`throwable_id` = ? LIMIT 1 FOR UPDATE",
    [userId, throwable.throwableId]
  );

  if (existingRows.length > 0) {
    return { itemId: Number(existingRows[0].item_id), created: false };
  }

  const [itemResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, UTC_TIMESTAMP(3), ?)",
    [userId, ITEM_TYPE_THROWABLE, userId]
  );

  await connection.execute(
    "INSERT INTO `THROWABLE` (`item_id`, `throwable_id`, `description`) VALUES (?, ?, ?)",
    [itemResult.insertId, throwable.throwableId, throwable.description]
  );

  return { itemId: itemResult.insertId, created: true };
}

async function ensureDefaultAgent(
  connection: PoolConnection,
  userId: string,
  agent: DefaultAgentTemplate
): Promise<EnsuredItem> {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    "SELECT `USER_ITEM`.`item_id` FROM `USER_ITEM` INNER JOIN `AGENT` ON `AGENT`.`item_id` = `USER_ITEM`.`item_id` WHERE `USER_ITEM`.`user_id` = ? AND `AGENT`.`agent_id` = ? LIMIT 1 FOR UPDATE",
    [userId, agent.agentId]
  );

  if (existingRows.length > 0) {
    return { itemId: Number(existingRows[0].item_id), created: false };
  }

  const [itemResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, ?, UTC_TIMESTAMP(3), ?)",
    [userId, ITEM_TYPE_AGENT, userId]
  );

  await connection.execute(
    "INSERT INTO `AGENT` (`item_id`, `agent_id`, `description`) VALUES (?, ?, ?)",
    [itemResult.insertId, agent.agentId, agent.description]
  );

  return { itemId: itemResult.insertId, created: true };
}

export async function syncAuthenticatedUser(
  userId: string,
  data: Record<string, unknown>,
  options?: { authEmail?: string | null }
) {
  const clientVersions = normalizeClientVersions(data.versions);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureRegisteredUser(connection, userId, options?.authEmail);
    await ensureUserVersions(userId, connection);

    const [settingsResult] = await connection.execute<ResultSetHeader>(
      "INSERT IGNORE INTO `USER_SETTINGS` (`user_id`, `settings`) VALUES (?, JSON_OBJECT())",
      [userId]
    );
    if (settingsResult.affectedRows > 0) {
      await incrementUserVersion(userId, "settings", connection);
    }

    const [genericStatsResult] = await connection.execute<ResultSetHeader>(
      "INSERT IGNORE INTO `USER_GENERIC_STATS` (`user_id`, `created_at`, `last_online`, `xp`) VALUES (?, UTC_DATE(), UTC_TIMESTAMP(3), 0)",
      [userId]
    );
    if (genericStatsResult.affectedRows > 0) {
      await incrementUserVersion(userId, "genericStats", connection);
    }

    const [playStatsResult] = await connection.execute<ResultSetHeader>(
      "INSERT IGNORE INTO `USER_PLAY_STATS` (`user_id`, `kills`, `deaths`, `wins`, `losses`, `damage_dealt`, `damage_taken`, `healing_done`, `headshots`, `shots_fired`, `shots_hit`, `playtime_seconds`) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)",
      [userId]
    );
    if (playStatsResult.affectedRows > 0) {
      await incrementUserVersion(userId, "playStats", connection);
    }

    const weaponItemIds = new Map<string, number>();
    let inventoryChanged = false;
    for (const weapon of defaultWeapons) {
      const ensuredWeapon = await ensureDefaultWeapon(connection, userId, weapon);
      weaponItemIds.set(weapon.weaponId, ensuredWeapon.itemId);
      inventoryChanged = inventoryChanged || ensuredWeapon.created;
    }

    const defaultMeleeResult = await ensureDefaultMelee(connection, userId, defaultMelee);
    const defaultMeleeItemId = defaultMeleeResult.itemId;
    inventoryChanged = inventoryChanged || defaultMeleeResult.created;

    const throwableItemIds = new Map<string, number>();
    for (const throwable of defaultThrowables) {
      const ensuredThrowable = await ensureDefaultThrowable(connection, userId, throwable);
      throwableItemIds.set(throwable.throwableId, ensuredThrowable.itemId);
      inventoryChanged = inventoryChanged || ensuredThrowable.created;
    }
    const defaultAgentResult = await ensureDefaultAgent(connection, userId, defaultAgent);
    const defaultAgentItemId = defaultAgentResult.itemId;
    inventoryChanged = inventoryChanged || defaultAgentResult.created;

    if (inventoryChanged) {
      await incrementUserVersion(userId, "inventory", connection);
    }

    const primaryGunId = requireDefaultItemId(weaponItemIds.get("M4A1"), "M4A1");
    const secondaryGunId = requireDefaultItemId(weaponItemIds.get("45 ACP"), "45 ACP");
    const grenadeItemId = requireDefaultItemId(throwableItemIds.get("grenade"), "grenade");
    let loadoutChanged = false;

    for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
      const [insertLoadoutResult] = await connection.execute<ResultSetHeader>(
        "INSERT IGNORE INTO `USER_LOADOUT` (`user_id`, `loadout_id`, `slot_index`, `primary_gun_id`, `secondary_gun_id`, `knife_id`, `throwable_id`, `agent_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          userId,
          slotIndex,
          slotIndex,
          primaryGunId,
          secondaryGunId,
          defaultMeleeItemId,
          grenadeItemId,
          defaultAgentItemId
        ]
      );
      loadoutChanged = loadoutChanged || insertLoadoutResult.affectedRows > 0;

      const [updateLoadoutResult] = await connection.execute<ResultSetHeader>(
        "UPDATE `USER_LOADOUT` SET `primary_gun_id` = COALESCE(`primary_gun_id`, ?), `secondary_gun_id` = COALESCE(`secondary_gun_id`, ?), `knife_id` = COALESCE(`knife_id`, ?), `throwable_id` = COALESCE(`throwable_id`, ?), `agent_id` = COALESCE(`agent_id`, ?) WHERE `user_id` = ? AND `slot_index` = ? AND (`primary_gun_id` IS NULL OR `secondary_gun_id` IS NULL OR `knife_id` IS NULL OR `throwable_id` IS NULL OR `agent_id` IS NULL)",
        [
          primaryGunId,
          secondaryGunId,
          defaultMeleeItemId,
          grenadeItemId,
          defaultAgentItemId,
          userId,
          slotIndex
        ]
      );
      loadoutChanged = loadoutChanged || updateLoadoutResult.affectedRows > 0;
    }

    if (loadoutChanged) {
      await incrementUserVersion(userId, "loadout", connection);
    }

    await setZeroVersionsToOne(userId, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return buildVersionedSyncResponse(userId, clientVersions);
}

async function buildVersionedSyncResponse(userId: string, clientVersions: ClientSyncVersions) {
  const [user, versions] = await Promise.all([getUserById(userId), getUserVersions(userId)]);
  const serverVersions = toClientSyncVersions(versions);
  const staleSections = getStaleSyncSections(clientVersions, serverVersions);
  const data: Record<string, unknown> = {};

  await Promise.all(
    staleSections.map(async (section) => {
      if (section === "settings") {
        const settings = await getUserSettings(userId);
        data.settings = settings.settings ?? {};
      }

      if (section === "genericStats") {
        data.genericStats = await getGenericStats(userId);
      }

      if (section === "playStats") {
        data.playStats = await getPlayStats(userId);
      }

      if (section === "loadout") {
        data.loadout = await listHydratedUserLoadouts(userId);
      }

      if (section === "inventory") {
        data.inventory = await listHydratedUserItems(userId);
      }
    })
  );

  return {
    user: {
      userId: user.id,
      username: user.username,
      email: user.email
    },
    serverVersions,
    data
  };
}
