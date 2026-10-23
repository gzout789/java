-- ============================================================
-- 三国登录系统 建表脚本（幂等，每次启动自动执行）
-- 依赖 JDBC 参数 createDatabaseIfNotExist=true 自动建库
-- ============================================================

CREATE TABLE IF NOT EXISTS `user` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username`    VARCHAR(50)  NOT NULL                COMMENT '将军名号（登录账号）',
  `password`    VARCHAR(100) NOT NULL                COMMENT '虎符密令（BCrypt 密文）',
  `faction`     VARCHAR(20)  NOT NULL DEFAULT 'han'  COMMENT '阵营：han/wei/shu/wu',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入册时间',
  `update_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='三国将军账号表';

CREATE TABLE IF NOT EXISTS `hero` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name`        VARCHAR(50)  NOT NULL                COMMENT '姓名',
  `epithet`     VARCHAR(50)  DEFAULT NULL            COMMENT '称号',
  `faction`     VARCHAR(20)  NOT NULL DEFAULT 'han'  COMMENT '阵营：han/wei/shu/wu',
  `type`        VARCHAR(20)  DEFAULT NULL            COMMENT '类型：君主/军师/猛将/统帅',
  `type_name`   VARCHAR(20)  DEFAULT NULL            COMMENT '类型展示名',
  `description` VARCHAR(255) DEFAULT NULL            COMMENT '小传',
  `power`       INT          DEFAULT NULL            COMMENT '武力',
  `leadership`  INT          DEFAULT NULL            COMMENT '统率',
  `sort_order`  INT          DEFAULT 0               COMMENT '排序',
  PRIMARY KEY (`id`),
  KEY `idx_faction` (`faction`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='英雄榜武将表';

CREATE TABLE IF NOT EXISTS `task` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `title`      VARCHAR(255) NOT NULL                COMMENT '要务内容',
  `done`       TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '是否办毕',
  `category`   VARCHAR(20)  DEFAULT NULL            COMMENT '类别',
  `sort_order` INT          DEFAULT 0               COMMENT '排序',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='军机要务表';

CREATE TABLE IF NOT EXISTS `news` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `content`    VARCHAR(255) NOT NULL                COMMENT '快报正文',
  `category`   VARCHAR(20)  DEFAULT NULL            COMMENT '类别',
  `sort_order` INT          DEFAULT 0               COMMENT '排序',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='烽火快报表';

CREATE TABLE IF NOT EXISTS `recruit` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`     BIGINT   NOT NULL                COMMENT '招募者（将军账号ID）',
  `hero_id`     BIGINT   NOT NULL                COMMENT '被招募的武将ID',
  `cost`        INT      NOT NULL DEFAULT 0      COMMENT '招募时耗费军饷（石）',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入帐时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_hero` (`user_id`, `hero_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点将台招募记录表';
