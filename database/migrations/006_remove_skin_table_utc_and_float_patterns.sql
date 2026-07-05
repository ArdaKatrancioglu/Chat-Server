SET @schema_name = DATABASE();

ALTER TABLE `WEAPON`
  MODIFY COLUMN `pattern_x` FLOAT,
  MODIFY COLUMN `pattern_y` FLOAT,
  MODIFY COLUMN `pattern_z` FLOAT;

ALTER TABLE `MELEE`
  MODIFY COLUMN `pattern_x` FLOAT,
  MODIFY COLUMN `pattern_y` FLOAT,
  MODIFY COLUMN `pattern_z` FLOAT;

ALTER TABLE `USER_GENERIC_STATS`
  MODIFY COLUMN `last_online` DATETIME(3) NULL;

ALTER TABLE `USER_ITEM`
  MODIFY COLUMN `acquired_at` DATETIME(3) NULL;

UPDATE `WEAPON`
SET `skin_id` = -1
WHERE `skin_id` = 0;

UPDATE `MELEE`
SET `skin_id` = -1
WHERE `skin_id` = 0;

SET @fk_name = NULL;
SELECT `CONSTRAINT_NAME`
INTO @fk_name
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'WEAPON'
  AND `REFERENCED_TABLE_NAME` = 'SKIN'
LIMIT 1;
SET @drop_fk_sql = IF(
  @fk_name IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `WEAPON` DROP FOREIGN KEY `', @fk_name, '`')
);
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

SET @fk_name = NULL;
SELECT `CONSTRAINT_NAME`
INTO @fk_name
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'MELEE'
  AND `REFERENCED_TABLE_NAME` = 'SKIN'
LIMIT 1;
SET @drop_fk_sql = IF(
  @fk_name IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `MELEE` DROP FOREIGN KEY `', @fk_name, '`')
);
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

SET @weapon_skin_material_exists = 0;
SELECT COUNT(*)
INTO @weapon_skin_material_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'WEAPON'
  AND `COLUMN_NAME` = 'skin_material_name';
SET @drop_weapon_skin_material_sql = IF(
  @weapon_skin_material_exists = 0,
  'SELECT 1',
  'ALTER TABLE `WEAPON` DROP COLUMN `skin_material_name`'
);
PREPARE drop_weapon_skin_material_stmt FROM @drop_weapon_skin_material_sql;
EXECUTE drop_weapon_skin_material_stmt;
DEALLOCATE PREPARE drop_weapon_skin_material_stmt;

SET @melee_skin_material_exists = 0;
SELECT COUNT(*)
INTO @melee_skin_material_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'MELEE'
  AND `COLUMN_NAME` = 'skin_material_name';
SET @drop_melee_skin_material_sql = IF(
  @melee_skin_material_exists = 0,
  'SELECT 1',
  'ALTER TABLE `MELEE` DROP COLUMN `skin_material_name`'
);
PREPARE drop_melee_skin_material_stmt FROM @drop_melee_skin_material_sql;
EXECUTE drop_melee_skin_material_stmt;
DEALLOCATE PREPARE drop_melee_skin_material_stmt;

DROP TABLE IF EXISTS `SKIN`;
