-- 商城会员用户名登录/注册改造（兼容 MySQL 5.7，可重复执行）
-- 执行后再部署包含用户名认证功能的服务端代码。

SET @username_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'member_user'
      AND COLUMN_NAME = 'username'
);
SET @add_username_column_sql = IF(
    @username_column_exists = 0,
    'ALTER TABLE `member_user` ADD COLUMN `username` varchar(20) NULL COMMENT ''用户名'' AFTER `id`',
    'SELECT ''member_user.username already exists'''
);
PREPARE add_username_column_stmt FROM @add_username_column_sql;
EXECUTE add_username_column_stmt;
DEALLOCATE PREPARE add_username_column_stmt;

SET @id_card_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'member_user'
      AND COLUMN_NAME = 'id_card'
);
SET @add_id_card_column_sql = IF(
    @id_card_column_exists = 0,
    'ALTER TABLE `member_user` ADD COLUMN `id_card` varchar(512) NULL COMMENT ''身份证照片 URL'' AFTER `avatar`',
    'SELECT ''member_user.id_card already exists'''
);
PREPARE add_id_card_column_stmt FROM @add_id_card_column_sql;
EXECUTE add_id_card_column_stmt;
DEALLOCATE PREPARE add_id_card_column_stmt;

ALTER TABLE `member_user`
    MODIFY COLUMN `mobile` varchar(11) NULL DEFAULT NULL COMMENT '手机号';

SET @username_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'member_user'
      AND INDEX_NAME = 'uk_tenant_username'
);
SET @add_username_index_sql = IF(
    @username_index_exists = 0,
    'ALTER TABLE `member_user` ADD UNIQUE KEY `uk_tenant_username` (`tenant_id`, `username`)',
    'SELECT ''member_user.uk_tenant_username already exists'''
);
PREPARE add_username_index_stmt FROM @add_username_index_sql;
EXECUTE add_username_index_stmt;
DEALLOCATE PREPARE add_username_index_stmt;
