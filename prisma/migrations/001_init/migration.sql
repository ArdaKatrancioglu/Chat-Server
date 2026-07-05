CREATE TABLE `USER` (
  `id` INT PRIMARY KEY,
  `username` VARCHAR(255),
  `email` VARCHAR(255)
);

CREATE TABLE `USER_PLAY_STATS` (
  `user_id` INT,
  `kills` INT,
  `deaths` INT,
  `matches_played` INT,
  `wins` INT,
  `losses` INT,
  `damage_dealt` INT,
  `damage_taken` INT,
  `healing_done` INT,
  `headshots` INT,
  `headshot_rate` FLOAT,
  `shots_fired` INT,
  `shots_hit` INT,
  `playtime_seconds` BIGINT
);

CREATE TABLE `USER_SETTINGS` (
  `user_id` INT,
  `settings` JSON
);

CREATE TABLE `USER_GENERIC_STATS` (
  `user_id` INT,
  `created_at` DATE,
  `last_online` DATE,
  `xp` INT
);

CREATE TABLE `USER_LOADOUT` (
  `user_id` INT,
  `loadout_id` INT,
  `slot_index` INT,
  `primary_gun_id` INT,
  `secondary_gun_id` INT,
  `knife_id` INT,
  `throwable_id` INT,
  FOREIGN KEY (`user_id`)
      REFERENCES `USER`(`id`)
);

CREATE TABLE `WEAPON` (
  `item_id` INT,
  `weapon_id` VARCHAR(255),
  `skin_id` INT,
  `description` VARCHAR(255),
  `pattern_x` INT,
  `pattern_y` INT,
  `pattern_z` INT
);

CREATE TABLE `USER_ITEM` (
  `user_id` INT,
  `item_id` INT,
  `item_type` INT UNSIGNED,
  `acquired_at` DATE,
  `first_owner_id` INT,
  FOREIGN KEY (`user_id`)
      REFERENCES `USER`(`id`)
);

CREATE TABLE `THROWABLE` (
  `item_id` INT,
  `throwable_id` VARCHAR(255),
  `description` VARCHAR(255)
);

CREATE TABLE `MELEE` (
  `item_id` INT,
  `melee_id` VARCHAR(255),
  `skin_id` INT,
  `description` VARCHAR(255),
  `pattern_x` INT,
  `pattern_y` INT,
  `pattern_z` INT
);

CREATE TABLE `SKIN` (
  `skin_id` INT,
  `material_name` INT,
  `finish_name` INT
);
