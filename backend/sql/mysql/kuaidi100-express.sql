-- 快递100常用快递公司初始化脚本
-- 说明：
-- 1. 修正原有快递鸟编码为快递100官方编码，并保留原记录 ID、logo 和订单关联。
-- 2. 新增 10 家常用快递公司，共启用 14 家。
-- 3. 脚本可重复执行，仅处理租户 1。

START TRANSACTION;

UPDATE `trade_delivery_express`
SET `code` = 'shentong'
WHERE `tenant_id` = 1 AND `deleted` = b'0' AND `code` = 'STO';

UPDATE `trade_delivery_express`
SET `code` = 'shunfeng'
WHERE `tenant_id` = 1 AND `deleted` = b'0' AND `code` = 'SF';

UPDATE `trade_delivery_express`
SET `code` = 'zhongtong'
WHERE `tenant_id` = 1 AND `deleted` = b'0' AND `code` = 'ZTO';

UPDATE `trade_delivery_express`
SET `code` = 'yunda'
WHERE `tenant_id` = 1 AND `deleted` = b'0' AND `code` = 'YD';

DROP TEMPORARY TABLE IF EXISTS `tmp_kuaidi100_express`;
CREATE TEMPORARY TABLE `tmp_kuaidi100_express` (
  `code` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `sort` int NOT NULL,
  PRIMARY KEY (`code`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tmp_kuaidi100_express` (`code`, `name`, `sort`) VALUES
('yuantong', '圆通速递', 1),
('zhongtong', '中通快递', 2),
('shentong', '申通快递', 3),
('yunda', '韵达快递', 4),
('jtexpress', '极兔速递', 5),
('shunfeng', '顺丰速运', 6),
('youzhengguonei', '邮政快递包裹', 7),
('jd', '京东物流', 8),
('ems', 'EMS', 9),
('debangkuaidi', '德邦快递', 10),
('danniao', '菜鸟速递', 11),
('annengwuliu', '安能快运', 12),
('kuayue', '跨越速运', 13),
('shunfengkuaiyun', '顺丰快运', 14);

UPDATE `trade_delivery_express` AS `express`
INNER JOIN `tmp_kuaidi100_express` AS `official`
  ON `express`.`tenant_id` = 1
  AND `express`.`deleted` = b'0'
  AND `express`.`code` = `official`.`code`
SET `express`.`name` = `official`.`name`,
    `express`.`sort` = `official`.`sort`,
    `express`.`status` = 0,
    `express`.`updater` = '1',
    `express`.`update_time` = NOW();

INSERT INTO `trade_delivery_express`
  (`code`, `name`, `logo`, `sort`, `status`, `creator`, `create_time`,
   `updater`, `update_time`, `deleted`, `tenant_id`)
SELECT
  `official`.`code`, `official`.`name`, NULL, `official`.`sort`, 0, '1', NOW(),
  '1', NOW(), b'0', 1
FROM `tmp_kuaidi100_express` AS `official`
LEFT JOIN `trade_delivery_express` AS `express`
  ON `express`.`tenant_id` = 1
  AND `express`.`deleted` = b'0'
  AND `express`.`code` = `official`.`code`
WHERE `express`.`id` IS NULL;

DROP TEMPORARY TABLE `tmp_kuaidi100_express`;

COMMIT;
