import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { getMeProfile } from "./me.service";

interface DefaultWeaponTemplate {
  weaponId: string;
  description: string;
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

function bodyString(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

async function ensureDefaultWeapon(
  connection: PoolConnection,
  userId: string,
  weapon: DefaultWeaponTemplate
): Promise<void> {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    "SELECT `USER_ITEM`.`item_id` FROM `USER_ITEM` INNER JOIN `WEAPON` ON `WEAPON`.`item_id` = `USER_ITEM`.`item_id` WHERE `USER_ITEM`.`user_id` = ? AND `WEAPON`.`weapon_id` = ? LIMIT 1 FOR UPDATE",
    [userId, weapon.weaponId]
  );

  if (existingRows.length > 0) {
    return;
  }

  const [itemResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO `USER_ITEM` (`user_id`, `item_type`, `acquired_at`, `first_owner_id`) VALUES (?, 1, CURRENT_DATE(), ?)",
    [userId, userId]
  );

  await connection.execute(
    "INSERT INTO `WEAPON` (`item_id`, `weapon_id`, `skin_id`, `description`, `pattern_x`, `pattern_y`, `pattern_z`) VALUES (?, ?, 0, ?, 0, 0, 0)",
    [itemResult.insertId, weapon.weaponId, weapon.description]
  );
}

export async function syncAuthenticatedUser(userId: string, data: Record<string, unknown>) {
  const username = bodyString(data.username, "Player");
  const email = bodyString(data.email, null);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      "INSERT IGNORE INTO `USER` (`id`, `username`, `email`) VALUES (?, ?, ?)",
      [userId, username, email]
    );

    await connection.execute("SELECT * FROM `USER` WHERE `id` = ? LIMIT 1 FOR UPDATE", [userId]);

    await connection.execute(
      "INSERT IGNORE INTO `USER_SETTINGS` (`user_id`, `settings`) VALUES (?, JSON_OBJECT())",
      [userId]
    );

    await connection.execute(
      "INSERT IGNORE INTO `USER_GENERIC_STATS` (`user_id`, `created_at`, `last_online`, `xp`) VALUES (?, CURRENT_DATE(), CURRENT_DATE(), 0)",
      [userId]
    );

    await connection.execute(
      "INSERT IGNORE INTO `USER_PLAY_STATS` (`user_id`, `kills`, `deaths`, `matches_played`, `wins`, `losses`, `damage_dealt`, `damage_taken`, `healing_done`, `headshots`, `headshot_rate`, `shots_fired`, `shots_hit`, `playtime_seconds`) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)",
      [userId]
    );

    for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
      await connection.execute(
        "INSERT IGNORE INTO `USER_LOADOUT` (`user_id`, `loadout_id`, `slot_index`, `primary_gun_id`, `secondary_gun_id`, `knife_id`, `throwable_id`) VALUES (?, ?, ?, NULL, NULL, NULL, NULL)",
        [userId, slotIndex, slotIndex]
      );
    }

    await connection.execute(
      "INSERT IGNORE INTO `SKIN` (`skin_id`, `material_name`, `finish_name`) VALUES (0, 0, 0)"
    );

    for (const weapon of defaultWeapons) {
      await ensureDefaultWeapon(connection, userId, weapon);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getMeProfile(userId);
}
