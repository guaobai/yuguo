-- 交易配置增加提现规则说明。
-- 部署包含 brokerageWithdrawRule 字段的服务端代码前执行，可重复执行。

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trade_config'
      AND COLUMN_NAME = 'brokerage_withdraw_rule'
);

SET @ddl = IF(
    @column_exists = 0,
    'ALTER TABLE `trade_config` ADD COLUMN `brokerage_withdraw_rule` text NULL COMMENT ''提现规则说明'' AFTER `brokerage_withdraw_types`',
    'SELECT ''trade_config.brokerage_withdraw_rule already exists'''
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
