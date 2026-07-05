SET @schema_name = DATABASE();

SET @drop_matches_played_sql = IF(
  EXISTS (
    SELECT 1
    FROM `INFORMATION_SCHEMA`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = @schema_name
      AND `TABLE_NAME` = 'USER_PLAY_STATS'
      AND `COLUMN_NAME` = 'matches_played'
  ),
  'ALTER TABLE `USER_PLAY_STATS` DROP COLUMN `matches_played`',
  'SELECT 1'
);
PREPARE drop_matches_played_stmt FROM @drop_matches_played_sql;
EXECUTE drop_matches_played_stmt;
DEALLOCATE PREPARE drop_matches_played_stmt;

SET @drop_headshot_rate_sql = IF(
  EXISTS (
    SELECT 1
    FROM `INFORMATION_SCHEMA`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = @schema_name
      AND `TABLE_NAME` = 'USER_PLAY_STATS'
      AND `COLUMN_NAME` = 'headshot_rate'
  ),
  'ALTER TABLE `USER_PLAY_STATS` DROP COLUMN `headshot_rate`',
  'SELECT 1'
);
PREPARE drop_headshot_rate_stmt FROM @drop_headshot_rate_sql;
EXECUTE drop_headshot_rate_stmt;
DEALLOCATE PREPARE drop_headshot_rate_stmt;

CREATE TABLE IF NOT EXISTS `user_versions` (
  `user_id` VARCHAR(128) PRIMARY KEY,
  `settings_version` INT NOT NULL DEFAULT 0,
  `generic_stats_version` INT NOT NULL DEFAULT 0,
  `play_stats_version` INT NOT NULL DEFAULT 0,
  `loadout_version` INT NOT NULL DEFAULT 0,
  `inventory_version` INT NOT NULL DEFAULT 0,
  CONSTRAINT `fk_user_versions_user`
    FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`)
);

SET @column_exists = 0;
SELECT COUNT(*)
INTO @column_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'settings_version';
SET @add_column_sql = IF(
  @column_exists = 0,
  'ALTER TABLE `user_versions` ADD COLUMN `settings_version` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @column_exists = 0;
SELECT COUNT(*)
INTO @column_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'generic_stats_version';
SET @add_column_sql = IF(
  @column_exists = 0,
  'ALTER TABLE `user_versions` ADD COLUMN `generic_stats_version` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @column_exists = 0;
SELECT COUNT(*)
INTO @column_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'play_stats_version';
SET @add_column_sql = IF(
  @column_exists = 0,
  'ALTER TABLE `user_versions` ADD COLUMN `play_stats_version` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @column_exists = 0;
SELECT COUNT(*)
INTO @column_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'loadout_version';
SET @add_column_sql = IF(
  @column_exists = 0,
  'ALTER TABLE `user_versions` ADD COLUMN `loadout_version` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @column_exists = 0;
SELECT COUNT(*)
INTO @column_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'inventory_version';
SET @add_column_sql = IF(
  @column_exists = 0,
  'ALTER TABLE `user_versions` ADD COLUMN `inventory_version` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @user_versions_has_primary = 0;
SELECT COUNT(*)
INTO @user_versions_has_primary
FROM `INFORMATION_SCHEMA`.`TABLE_CONSTRAINTS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `CONSTRAINT_TYPE` = 'PRIMARY KEY';

SET @user_versions_duplicate_ids = 0;
SELECT COUNT(*)
INTO @user_versions_duplicate_ids
FROM (
  SELECT `user_id`
  FROM `user_versions`
  WHERE `user_id` IS NOT NULL
  GROUP BY `user_id`
  HAVING COUNT(*) > 1
) AS duplicate_version_users;

SET @user_versions_null_ids = 0;
SELECT COUNT(*)
INTO @user_versions_null_ids
FROM `user_versions`
WHERE `user_id` IS NULL;

SET @add_user_versions_primary_sql = IF(
  @user_versions_has_primary = 0
    AND @user_versions_duplicate_ids = 0
    AND @user_versions_null_ids = 0,
  'ALTER TABLE `user_versions` MODIFY COLUMN `user_id` VARCHAR(128) NOT NULL, ADD PRIMARY KEY (`user_id`)',
  'SELECT 1'
);
PREPARE add_user_versions_primary_stmt FROM @add_user_versions_primary_sql;
EXECUTE add_user_versions_primary_stmt;
DEALLOCATE PREPARE add_user_versions_primary_stmt;

SET @user_versions_fk_exists = 0;
SELECT COUNT(*)
INTO @user_versions_fk_exists
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'user_versions'
  AND `COLUMN_NAME` = 'user_id'
  AND `REFERENCED_TABLE_NAME` = 'USER'
  AND `REFERENCED_COLUMN_NAME` = 'id';

SET @user_versions_orphan_ids = 0;
SELECT COUNT(*)
INTO @user_versions_orphan_ids
FROM `user_versions`
LEFT JOIN `USER` ON `USER`.`id` = `user_versions`.`user_id`
WHERE `user_versions`.`user_id` IS NOT NULL
  AND `USER`.`id` IS NULL;

SET @add_user_versions_fk_sql = IF(
  @user_versions_fk_exists = 0 AND @user_versions_orphan_ids = 0,
  'ALTER TABLE `user_versions` ADD CONSTRAINT `fk_user_versions_user_existing` FOREIGN KEY (`user_id`) REFERENCES `USER`(`id`)',
  'SELECT 1'
);
PREPARE add_user_versions_fk_stmt FROM @add_user_versions_fk_sql;
EXECUTE add_user_versions_fk_stmt;
DEALLOCATE PREPARE add_user_versions_fk_stmt;
