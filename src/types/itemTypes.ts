export const ITEM_TYPE_WEAPON = 1;
export const ITEM_TYPE_MELEE = 2;
export const ITEM_TYPE_THROWABLE = 3;
export const ITEM_TYPE_AGENT = 4;

export type ItemTypeName = "weapon" | "melee" | "throwable" | "agent";

export function itemTypeCodeToName(itemType: number | null): ItemTypeName | "unknown" {
  if (itemType === ITEM_TYPE_WEAPON) {
    return "weapon";
  }

  if (itemType === ITEM_TYPE_MELEE) {
    return "melee";
  }

  if (itemType === ITEM_TYPE_THROWABLE) {
    return "throwable";
  }

  if (itemType === ITEM_TYPE_AGENT) {
    return "agent";
  }

  return "unknown";
}

export function parseItemType(value: unknown): number | null {
  if (value === ITEM_TYPE_WEAPON || value === "weapon") {
    return ITEM_TYPE_WEAPON;
  }

  if (value === ITEM_TYPE_MELEE || value === "melee") {
    return ITEM_TYPE_MELEE;
  }

  if (value === ITEM_TYPE_THROWABLE || value === "throwable") {
    return ITEM_TYPE_THROWABLE;
  }

  if (value === ITEM_TYPE_AGENT || value === "agent") {
    return ITEM_TYPE_AGENT;
  }

  return null;
}
