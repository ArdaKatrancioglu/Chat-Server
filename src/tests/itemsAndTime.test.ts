import assert from "node:assert/strict";
import test from "node:test";
import { validateTypedItemPayload } from "../services/items.service";
import { normalizeUtcDate, toUtcIsoString } from "../utils/time";

test("last_online is normalized and returned as UTC ISO-8601", () => {
  const value = normalizeUtcDate("2026-07-05T14:30:00+03:00");

  assert.equal(toUtcIsoString(value), "2026-07-05T11:30:00.000Z");
});

test("weapon item payload accepts decimal pattern values", () => {
  const payload = validateTypedItemPayload({
    item_type: "weapon",
    details: {
      weapon_id: "m4a1",
      skin_id: 12,
      description: "M4A1 Fade",
      pattern_x: 0.125,
      pattern_y: 0.75,
      pattern_z: 0.5
    }
  });

  assert.equal(payload.itemType, 1);
  assert.equal(payload.details.pattern_x, 0.125);
});

test("melee item payload accepts decimal pattern values", () => {
  const payload = validateTypedItemPayload({
    item_type: "melee",
    details: {
      melee_id: "m9_bayonet",
      skin_id: 12,
      description: "M9 Bayonet Fade",
      pattern_x: 0.125,
      pattern_y: 0.75,
      pattern_z: 0.5
    }
  });

  assert.equal(payload.itemType, 2);
  assert.equal(payload.details.pattern_y, 0.75);
});

test("agent and throwable item payloads validate type-specific details", () => {
  assert.equal(
    validateTypedItemPayload({
      item_type: "agent",
      details: { agent_id: "default_agent", description: "Default Agent" }
    }).itemType,
    4
  );

  assert.equal(
    validateTypedItemPayload({
      item_type: "throwable",
      details: { throwable_id: "smoke_grenade", description: "Smoke Grenade" }
    }).itemType,
    3
  );
});

test("invalid selected item details return a clear validation error", () => {
  assert.throws(
    () =>
      validateTypedItemPayload({
        item_type: "weapon",
        details: { melee_id: "wrong", skin_id: -1, pattern_x: 0, pattern_y: 0, pattern_z: 0 }
      }),
    /details\.weapon_id is required/
  );
});

test("vanilla weapon and melee payloads use skin_id -1", () => {
  assert.equal(
    validateTypedItemPayload({
      item_type: "weapon",
      details: {
        weapon_id: "m4a1",
        skin_id: -1,
        pattern_x: 0,
        pattern_y: 0,
        pattern_z: 0
      }
    }).details.skin_id,
    -1
  );

  assert.equal(
    validateTypedItemPayload({
      item_type: "melee",
      details: {
        melee_id: "default_ct",
        skin_id: -1,
        pattern_x: 0,
        pattern_y: 0,
        pattern_z: 0
      }
    }).details.skin_id,
    -1
  );
});
