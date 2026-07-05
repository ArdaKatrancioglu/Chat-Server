CREATE TABLE IF NOT EXISTS `AGENT` (
  `item_id` INT,
  `agent_id` VARCHAR(255),
  `description` VARCHAR(255)
);

ALTER TABLE `USER_LOADOUT`
  ADD COLUMN `agent_id` INT NULL;

SET @schema_name = DATABASE();

SET @agent_has_primary = 0;
SELECT COUNT(*)
INTO @agent_has_primary
FROM `INFORMATION_SCHEMA`.`TABLE_CONSTRAINTS`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'AGENT'
  AND `CONSTRAINT_TYPE` = 'PRIMARY KEY';

SET @agent_duplicate_item_ids = 0;
SELECT COUNT(*)
INTO @agent_duplicate_item_ids
FROM (
  SELECT `item_id`
  FROM `AGENT`
  WHERE `item_id` IS NOT NULL
  GROUP BY `item_id`
  HAVING COUNT(*) > 1
) AS duplicate_agent_items;

SET @agent_null_item_ids = 0;
SELECT COUNT(*)
INTO @agent_null_item_ids
FROM `AGENT`
WHERE `item_id` IS NULL;

SET @add_agent_primary_sql = IF(
  @agent_has_primary = 0 AND @agent_duplicate_item_ids = 0 AND @agent_null_item_ids = 0,
  'ALTER TABLE `AGENT` MODIFY COLUMN `item_id` INT NOT NULL, ADD PRIMARY KEY (`item_id`)',
  'SELECT 1'
);
PREPARE add_agent_primary_stmt FROM @add_agent_primary_sql;
EXECUTE add_agent_primary_stmt;
DEALLOCATE PREPARE add_agent_primary_stmt;

SET @agent_fk_exists = 0;
SELECT COUNT(*)
INTO @agent_fk_exists
FROM `INFORMATION_SCHEMA`.`KEY_COLUMN_USAGE`
WHERE `TABLE_SCHEMA` = @schema_name
  AND `TABLE_NAME` = 'AGENT'
  AND `COLUMN_NAME` = 'item_id'
  AND `REFERENCED_TABLE_NAME` = 'USER_ITEM'
  AND `REFERENCED_COLUMN_NAME` = 'item_id';

SET @agent_orphan_items = 0;
SELECT COUNT(*)
INTO @agent_orphan_items
FROM `AGENT`
LEFT JOIN `USER_ITEM` ON `USER_ITEM`.`item_id` = `AGENT`.`item_id`
WHERE `AGENT`.`item_id` IS NOT NULL
  AND `USER_ITEM`.`item_id` IS NULL;

SET @add_agent_fk_sql = IF(
  @agent_fk_exists = 0 AND @agent_orphan_items = 0,
  'ALTER TABLE `AGENT` ADD CONSTRAINT `fk_agent_user_item` FOREIGN KEY (`item_id`) REFERENCES `USER_ITEM`(`item_id`)',
  'SELECT 1'
);
PREPARE add_agent_fk_stmt FROM @add_agent_fk_sql;
EXECUTE add_agent_fk_stmt;
DEALLOCATE PREPARE add_agent_fk_stmt;
