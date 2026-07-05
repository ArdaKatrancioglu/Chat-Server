SET @schema_name = DATABASE();

SET @fk_name = NULL;
SELECT `CONSTRAINT_NAME`
INTO @fk_name
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'USER_LOADOUT'
  AND `COLUMN_NAME` = 'user_id'
  AND `REFERENCED_TABLE_NAME` = 'USER'
LIMIT 1;
SET @drop_fk_sql = IF(
  @fk_name IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `USER_LOADOUT` DROP FOREIGN KEY `', @fk_name, '`')
);
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

SET @fk_name = NULL;
SELECT `CONSTRAINT_NAME`
INTO @fk_name
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'USER_ITEM'
  AND `COLUMN_NAME` = 'user_id'
  AND `REFERENCED_TABLE_NAME` = 'USER'
LIMIT 1;
SET @drop_fk_sql = IF(
  @fk_name IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `USER_ITEM` DROP FOREIGN KEY `', @fk_name, '`')
);
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

ALTER TABLE `USER`
  MODIFY COLUMN `id` VARCHAR(128) NOT NULL;

ALTER TABLE `USER_SETTINGS`
  MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL,
  ADD PRIMARY KEY (`user_id`),
  ADD CONSTRAINT `fk_user_settings_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`);

ALTER TABLE `USER_GENERIC_STATS`
  MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL,
  ADD PRIMARY KEY (`user_id`),
  ADD CONSTRAINT `fk_user_generic_stats_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`);

ALTER TABLE `USER_PLAY_STATS`
  MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL,
  ADD PRIMARY KEY (`user_id`),
  ADD CONSTRAINT `fk_user_play_stats_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`);

ALTER TABLE `USER_LOADOUT`
  MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL,
  ADD UNIQUE KEY `uq_user_loadout_user_slot` (`user_id`, `slot_index`),
  ADD CONSTRAINT `fk_user_loadout_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`);

ALTER TABLE `SKIN`
  MODIFY COLUMN `skin_id` INT NOT NULL,
  ADD PRIMARY KEY (`skin_id`);

ALTER TABLE `USER_ITEM`
  MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL,
  MODIFY COLUMN `item_id` INT NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN `first_owner_id` VARCHAR(128) NULL,
  ADD PRIMARY KEY (`item_id`),
  ADD CONSTRAINT `fk_user_item_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`);

ALTER TABLE `WEAPON`
  MODIFY COLUMN `item_id` INT NOT NULL,
  ADD PRIMARY KEY (`item_id`),
  ADD CONSTRAINT `fk_weapon_user_item`
    FOREIGN KEY (`item_id`) REFERENCES `USER_ITEM`(`item_id`);

ALTER TABLE `MELEE`
  MODIFY COLUMN `item_id` INT NOT NULL,
  ADD PRIMARY KEY (`item_id`),
  ADD CONSTRAINT `fk_melee_user_item`
    FOREIGN KEY (`item_id`) REFERENCES `USER_ITEM`(`item_id`);

ALTER TABLE `THROWABLE`
  MODIFY COLUMN `item_id` INT NOT NULL,
  ADD PRIMARY KEY (`item_id`),
  ADD CONSTRAINT `fk_throwable_user_item`
    FOREIGN KEY (`item_id`) REFERENCES `USER_ITEM`(`item_id`);
