SET @schema_name = DATABASE();

ALTER TABLE `SKIN`
  MODIFY COLUMN `material_name` VARCHAR(255) NULL;

UPDATE `SKIN`
SET `material_name` = 'vanilla'
WHERE `skin_id` = 0;

INSERT INTO `SKIN` (`skin_id`, `material_name`, `finish_name`)
SELECT 0, 'vanilla', 0
WHERE NOT EXISTS (
  SELECT 1 FROM `SKIN` WHERE `material_name` = 'vanilla'
);

UPDATE `SKIN`
SET `material_name` = CONCAT('skin_', COALESCE(CAST(`skin_id` AS CHAR), UUID()))
WHERE `material_name` IS NULL OR `material_name` = '';

UPDATE `SKIN`
INNER JOIN (
  SELECT `material_name`
  FROM `SKIN`
  GROUP BY `material_name`
  HAVING COUNT(*) > 1
) AS duplicates ON duplicates.`material_name` = `SKIN`.`material_name`
SET `SKIN`.`material_name` = CONCAT(`SKIN`.`material_name`, '_', COALESCE(CAST(`SKIN`.`skin_id` AS CHAR), UUID()));

SET @weapon_skin_material_exists = 0;
SELECT COUNT(*)
INTO @weapon_skin_material_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'WEAPON'
  AND `COLUMN_NAME` = 'skin_material_name';
SET @add_weapon_skin_material_sql = IF(
  @weapon_skin_material_exists = 0,
  'ALTER TABLE `WEAPON` ADD COLUMN `skin_material_name` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE add_weapon_skin_material_stmt FROM @add_weapon_skin_material_sql;
EXECUTE add_weapon_skin_material_stmt;
DEALLOCATE PREPARE add_weapon_skin_material_stmt;

SET @melee_skin_material_exists = 0;
SELECT COUNT(*)
INTO @melee_skin_material_exists
FROM `INFORMATION_SCHEMA`.`COLUMNS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'MELEE'
  AND `COLUMN_NAME` = 'skin_material_name';
SET @add_melee_skin_material_sql = IF(
  @melee_skin_material_exists = 0,
  'ALTER TABLE `MELEE` ADD COLUMN `skin_material_name` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE add_melee_skin_material_stmt FROM @add_melee_skin_material_sql;
EXECUTE add_melee_skin_material_stmt;
DEALLOCATE PREPARE add_melee_skin_material_stmt;

UPDATE `WEAPON`
LEFT JOIN `SKIN` ON `SKIN`.`skin_id` = `WEAPON`.`skin_id`
SET `WEAPON`.`skin_material_name` = COALESCE(`SKIN`.`material_name`, 'vanilla')
WHERE `WEAPON`.`skin_material_name` IS NULL;

UPDATE `MELEE`
LEFT JOIN `SKIN` ON `SKIN`.`skin_id` = `MELEE`.`skin_id`
SET `MELEE`.`skin_material_name` = COALESCE(`SKIN`.`material_name`, 'vanilla')
WHERE `MELEE`.`skin_material_name` IS NULL;

SET @skin_primary_name = NULL;
SELECT `COLUMN_NAME`
INTO @skin_primary_name
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'SKIN'
  AND `CONSTRAINT_NAME` = 'PRIMARY'
ORDER BY `ORDINAL_POSITION`
LIMIT 1;
SET @drop_skin_primary_sql = IF(
  @skin_primary_name IS NOT NULL AND @skin_primary_name <> 'material_name',
  'ALTER TABLE `SKIN` DROP PRIMARY KEY',
  'SELECT 1'
);
PREPARE drop_skin_primary_stmt FROM @drop_skin_primary_sql;
EXECUTE drop_skin_primary_stmt;
DEALLOCATE PREPARE drop_skin_primary_stmt;

SET @skin_has_primary = 0;
SELECT COUNT(*)
INTO @skin_has_primary
FROM `INFORMATION_SCHEMA`.`TABLE_CONSTRAINTS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'SKIN'
  AND `CONSTRAINT_TYPE` = 'PRIMARY KEY';

SET @skin_duplicate_materials = 0;
SELECT COUNT(*)
INTO @skin_duplicate_materials
FROM (
  SELECT `material_name`
  FROM `SKIN`
  GROUP BY `material_name`
  HAVING COUNT(*) > 1
) AS duplicate_materials;

SET @skin_null_materials = 0;
SELECT COUNT(*)
INTO @skin_null_materials
FROM `SKIN`
WHERE `material_name` IS NULL OR `material_name` = '';

SET @add_skin_primary_sql = IF(
  @skin_has_primary = 0 AND @skin_duplicate_materials = 0 AND @skin_null_materials = 0,
  'ALTER TABLE `SKIN` MODIFY COLUMN `material_name` VARCHAR(255) NOT NULL, ADD PRIMARY KEY (`material_name`)',
  'SELECT 1'
);
PREPARE add_skin_primary_stmt FROM @add_skin_primary_sql;
EXECUTE add_skin_primary_stmt;
DEALLOCATE PREPARE add_skin_primary_stmt;

SET @weapon_skin_fk_exists = 0;
SELECT COUNT(*)
INTO @weapon_skin_fk_exists
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'WEAPON'
  AND `COLUMN_NAME` = 'skin_material_name'
  AND `REFERENCED_TABLE_NAME` = 'SKIN'
  AND `REFERENCED_COLUMN_NAME` = 'material_name';

SET @weapon_skin_orphans = 0;
SELECT COUNT(*)
INTO @weapon_skin_orphans
FROM `WEAPON`
LEFT JOIN `SKIN` ON `SKIN`.`material_name` = `WEAPON`.`skin_material_name`
WHERE `WEAPON`.`skin_material_name` IS NOT NULL
  AND `SKIN`.`material_name` IS NULL;

SET @add_weapon_skin_fk_sql = IF(
  @weapon_skin_fk_exists = 0 AND @weapon_skin_orphans = 0 AND @skin_duplicate_materials = 0,
  'ALTER TABLE `WEAPON` ADD CONSTRAINT `fk_weapon_skin_material` FOREIGN KEY (`skin_material_name`) REFERENCES `SKIN`(`material_name`)',
  'SELECT 1'
);
PREPARE add_weapon_skin_fk_stmt FROM @add_weapon_skin_fk_sql;
EXECUTE add_weapon_skin_fk_stmt;
DEALLOCATE PREPARE add_weapon_skin_fk_stmt;

SET @melee_skin_fk_exists = 0;
SELECT COUNT(*)
INTO @melee_skin_fk_exists
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'MELEE'
  AND `COLUMN_NAME` = 'skin_material_name'
  AND `REFERENCED_TABLE_NAME` = 'SKIN'
  AND `REFERENCED_COLUMN_NAME` = 'material_name';

SET @melee_skin_orphans = 0;
SELECT COUNT(*)
INTO @melee_skin_orphans
FROM `MELEE`
LEFT JOIN `SKIN` ON `SKIN`.`material_name` = `MELEE`.`skin_material_name`
WHERE `MELEE`.`skin_material_name` IS NOT NULL
  AND `SKIN`.`material_name` IS NULL;

SET @add_melee_skin_fk_sql = IF(
  @melee_skin_fk_exists = 0 AND @melee_skin_orphans = 0 AND @skin_duplicate_materials = 0,
  'ALTER TABLE `MELEE` ADD CONSTRAINT `fk_melee_skin_material` FOREIGN KEY (`skin_material_name`) REFERENCES `SKIN`(`material_name`)',
  'SELECT 1'
);
PREPARE add_melee_skin_fk_stmt FROM @add_melee_skin_fk_sql;
EXECUTE add_melee_skin_fk_stmt;
DEALLOCATE PREPARE add_melee_skin_fk_stmt;
