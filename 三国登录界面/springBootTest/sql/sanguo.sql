-- ============================================================
-- 三国登录 / 注册  建库建表脚本（本地备份用）
-- 数据库：MySQL 8.0    账号：root / 123456
-- 字符集：utf8mb4（支持中文）
--
-- 说明：本脚本为手动初始化/恢复用。正常情况下无需手动执行——
--   后端启动时会通过 JDBC 参数 createDatabaseIfNotExist=true 自动建库，
--   并执行 src/main/resources/schema.sql 自动建表，
--   还会自动播种演示账号（云长 / danfeng123）。
--
-- 手动执行方式（PowerShell 或 CMD）：
--   "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -uroot -p123456 < sql\sanguo.sql
-- ============================================================

-- 1) 创建数据库（若不存在）
CREATE DATABASE IF NOT EXISTS sanguo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

-- 2) 使用数据库
USE sanguo;

-- 3) 用户表（将军账号）
CREATE TABLE IF NOT EXISTS `user` (
  `id`          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username`    VARCHAR(50)   NOT NULL                COMMENT '将军名号（登录账号）',
  `password`    VARCHAR(100)  NOT NULL                COMMENT '虎符密令（BCrypt 加密存储）',
  `faction`     VARCHAR(20)   NOT NULL DEFAULT 'han'  COMMENT '阵营：han 汉室 / wei 曹魏 / shu 蜀汉 / wu 东吴',
  `create_time` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP                 COMMENT '入册时间',
  `update_time` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='三国将军账号表';

-- 4) 查看现有账号（密码为 BCrypt 密文，不展示）
-- SELECT id, username, faction, create_time FROM `user`;

-- ============================================================
-- 附：清空账号表（调试用，按需执行）
-- TRUNCATE TABLE sanguo.`user`;
-- ============================================================
