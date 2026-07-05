import assert from "node:assert/strict";
import test from "node:test";
import {
  playStatsColumns,
  selectGenericStatsPatchColumns,
  selectPlayStatsPatchColumns
} from "../services/stats.service";
import { shouldFillDefaultLoadout } from "../services/sync.service";
import {
  getStaleSyncSections,
  normalizeClientVersions,
  toClientSyncVersions
} from "../services/versions.service";
import type { UserVersions } from "../types/db";

test("/auth/sync stale comparison returns only stale sections", () => {
  assert.deepEqual(
    getStaleSyncSections(
      {
        settings: 1,
        genericStats: 1,
        playStats: 1,
        loadout: 1,
        inventory: 0
      },
      {
        settings: 1,
        genericStats: 1,
        playStats: 1,
        loadout: 1,
        inventory: 2
      }
    ),
    ["inventory"]
  );
});

test("/auth/sync returns no stale sections when all versions match", () => {
  const versions = {
    settings: 3,
    genericStats: 4,
    playStats: 5,
    loadout: 6,
    inventory: 7
  };

  assert.deepEqual(getStaleSyncSections(versions, versions), []);
});

test("missing client versions are treated as zero", () => {
  assert.deepEqual(normalizeClientVersions({ inventory: 2 }), {
    settings: 0,
    genericStats: 0,
    playStats: 0,
    loadout: 0,
    inventory: 2
  });
});

test("inventory version mismatch marks full inventory section stale", () => {
  assert.deepEqual(
    getStaleSyncSections(normalizeClientVersions({ inventory: 1 }), {
      settings: 0,
      genericStats: 0,
      playStats: 0,
      loadout: 0,
      inventory: 2
    }),
    ["inventory"]
  );
});

test("server version rows are exposed as sync response versions", () => {
  const row: UserVersions = {
    user_id: "local-dev-user",
    settings_version: 1,
    generic_stats_version: 2,
    play_stats_version: 3,
    loadout_version: 4,
    inventory_version: 5
  };

  assert.deepEqual(toClientSyncVersions(row), {
    settings: 1,
    genericStats: 2,
    playStats: 3,
    loadout: 4,
    inventory: 5
  });
});

test("removed play stat fields are no longer stored", () => {
  assert.equal(playStatsColumns.includes("matches_played"), false);
  assert.equal(playStatsColumns.includes("headshot_rate"), false);
});

test("PATCH /me/generic-stats updates only provided fields", () => {
  assert.deepEqual(selectGenericStatsPatchColumns({ xp: 10, email: "nope" }), ["xp"]);
  assert.deepEqual(selectGenericStatsPatchColumns({ last_online: "2026-07-05" }), ["last_online"]);
});

test("PATCH /me/play-stats accepts raw counters and ignores derived fields", () => {
  assert.deepEqual(
    selectPlayStatsPatchColumns({
      kills: 1,
      wins: 2,
      matches_played: 999,
      headshot_rate: 0.5,
      accuracy: 0.25,
      win_rate: 0.75
    }),
    ["kills", "wins"]
  );
});

test("repeated /auth/sync should not refill complete default loadouts", () => {
  assert.equal(
    shouldFillDefaultLoadout({
      primary_gun_id: 1,
      secondary_gun_id: 2,
      knife_id: 3,
      throwable_id: 4,
      agent_id: 5
    }),
    false
  );

  assert.equal(
    shouldFillDefaultLoadout({
      primary_gun_id: 1,
      secondary_gun_id: null,
      knife_id: 3,
      throwable_id: 4,
      agent_id: 5
    }),
    true
  );
});

test("weapon and melee details do not expose removed material_name", () => {
  const weaponDetails = {
    weapon_id: "m4a1",
    skin_id: -1,
    pattern_x: 0.125,
    pattern_y: 0.75,
    pattern_z: 0.5
  };
  const meleeDetails = {
    melee_id: "m9_bayonet",
    skin_id: -1,
    pattern_x: 0.125,
    pattern_y: 0.75,
    pattern_z: 0.5
  };

  assert.equal("material_name" in weaponDetails, false);
  assert.equal("material_name" in meleeDetails, false);
  assert.equal(weaponDetails.skin_id, -1);
  assert.equal(meleeDetails.skin_id, -1);
});
