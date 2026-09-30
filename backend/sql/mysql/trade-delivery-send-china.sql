-- 运费模板增加国外发货标记（兼容 MySQL 5.7，可重复执行）
-- 1 = 国内发货，2 = 国外发货。已有模板默认按国内发货处理。

SET @send_china_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trade_delivery_express_template'
      AND COLUMN_NAME = 'send_china'
);
SET @add_send_china_column_sql = IF(
    @send_china_column_exists = 0,
    'ALTER TABLE `trade_delivery_express_template` ADD COLUMN `send_china` tinyint NOT NULL DEFAULT 1 COMMENT ''是否国外发货：1 否，2 是'' AFTER `charge_mode`',
    'SELECT ''trade_delivery_express_template.send_china already exists'''
);
PREPARE add_send_china_column_stmt FROM @add_send_china_column_sql;
EXECUTE add_send_china_column_stmt;
DEALLOCATE PREPARE add_send_china_column_stmt;

UPDATE `trade_delivery_express_template`
SET `send_china` = 1
WHERE `send_china` IS NULL;

ALTER TABLE `trade_delivery_express_template`
    MODIFY COLUMN `send_china` tinyint NOT NULL DEFAULT 1 COMMENT '是否国外发货：1 否，2 是';
