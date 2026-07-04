export type DbId = number;

export interface User {
  id: number;
  username: string | null;
  email: string | null;
}

export interface UserPlayStats {
  user_id: number;
  kills: number | null;
  deaths: number | null;
  matches_played: number | null;
  wins: number | null;
  losses: number | null;
  damage_dealt: number | null;
  damage_taken: number | null;
  healing_done: number | null;
  headshots: number | null;
  headshot_rate: number | null;
  shots_fired: number | null;
  shots_hit: number | null;
  playtime_seconds: number | string | null;
}

export interface UserGenericStats {
  user_id: number;
  created_at: string | Date | null;
  last_online: string | Date | null;
  xp: number | null;
}

export interface UserLoadout {
  user_id: number;
  loadout_id: number | null;
  slot_index: number | null;
  primary_gun_id: number | null;
  secondary_gun_id: number | null;
  knife_id: number | null;
  throwable_id: number | null;
}

export interface UserItem {
  user_id: number;
  item_id: number | null;
  item_type: number | null;
  acquired_at: string | Date | null;
  first_owner_id: number | null;
}

export interface Weapon {
  item_id: number | null;
  weapon_id: string | null;
  skin_id: number | null;
  description: string | null;
  pattern_x: number | null;
  pattern_y: number | null;
  pattern_z: number | null;
}

export interface Melee {
  item_id: number | null;
  melee_id: string | null;
  skin_id: number | null;
  description: string | null;
  pattern_x: number | null;
  pattern_y: number | null;
  pattern_z: number | null;
}

export interface ThrowableItem {
  item_id: number | null;
  throwable_id: string | null;
  description: string | null;
}

export interface Skin {
  skin_id: number | null;
  material_name: number | null;
  finish_name: number | null;
}
