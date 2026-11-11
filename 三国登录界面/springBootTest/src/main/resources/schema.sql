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

CREATE TABLE IF NOT EXISTS `gacha_log` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id`     BIGINT   NOT NULL                COMMENT '抽卡者（将军账号ID）',
  `hero_id`     BIGINT   DEFAULT NULL            COMMENT '抽中的武将ID',
  `cost`        INT      NOT NULL DEFAULT 0      COMMENT '本次消耗军饷（石）',
  `refund`      INT      NOT NULL DEFAULT 0      COMMENT '重复返还军饷（石）',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽卡时间',
  PRIMARY KEY (`id`),
  KEY `idx_gacha_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='抽卡流水表';

-- 后台管理账号（与前台将军账号物理隔离，互不通用）
CREATE TABLE IF NOT EXISTS `admin_user` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username`    VARCHAR(50)  NOT NULL                COMMENT '管理账号',
  `password`    VARCHAR(100) NOT NULL                COMMENT '密码（BCrypt 密文）',
  `role`        VARCHAR(20)  NOT NULL DEFAULT 'admin' COMMENT '角色：admin/editor',
  `remark`      VARCHAR(100) DEFAULT NULL            COMMENT '备注',
  `last_login`  DATETIME     DEFAULT NULL            COMMENT '最近登录时间',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台管理账号表';

-- ============================================================
-- 同袍系统：好友结交 / 私信往来 / 组队共入烽烟三国杀
-- 全部 CREATE TABLE IF NOT EXISTS，老库重启时自动补齐，不影响已有数据
-- ============================================================

-- 结交帖（好友申请）
CREATE TABLE IF NOT EXISTS `friend_request` (
  `id`            BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `from_user_id`  BIGINT      NOT NULL                COMMENT '发起者',
  `to_user_id`    BIGINT      NOT NULL                COMMENT '接收者',
  `message`       VARCHAR(120) DEFAULT NULL           COMMENT '附言',
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/accepted/rejected',
  `create_time`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `handle_time`   DATETIME    DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fr_to` (`to_user_id`, `status`),
  KEY `idx_fr_from` (`from_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同袍结交帖表';

-- 好友关系（双向各存一条，便于单向查询）
CREATE TABLE IF NOT EXISTS `friendship` (
  `id`          BIGINT   NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT   NOT NULL,
  `friend_id`   BIGINT   NOT NULL,
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_friend_pair` (`user_id`, `friend_id`),
  KEY `idx_fs_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同袍好友关系表';

-- 私信
CREATE TABLE IF NOT EXISTS `friend_message` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `from_user_id` BIGINT       NOT NULL,
  `to_user_id`   BIGINT       NOT NULL,
  `content`      VARCHAR(500) NOT NULL,
  `is_read`      TINYINT(1)   NOT NULL DEFAULT 0,
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fm_pair` (`from_user_id`, `to_user_id`, `id`),
  KEY `idx_fm_to` (`to_user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='同袍私信表';

-- 组队房间
CREATE TABLE IF NOT EXISTS `team_room` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(12) NOT NULL                COMMENT '房号（邀请码）',
  `name`        VARCHAR(40) NOT NULL DEFAULT '同袍联队',
  `leader_id`   BIGINT      NOT NULL                COMMENT '房主',
  `status`      VARCHAR(16) NOT NULL DEFAULT 'waiting' COMMENT 'waiting/playing/closed',
  `create_time` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `start_time`  DATETIME    DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='烽烟联队房间表';

-- 队员
CREATE TABLE IF NOT EXISTS `team_member` (
  `id`        BIGINT   NOT NULL AUTO_INCREMENT,
  `room_id`   BIGINT   NOT NULL,
  `user_id`   BIGINT   NOT NULL,
  `join_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_member` (`room_id`, `user_id`),
  KEY `idx_tm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联队成员表';

-- 组队邀请
CREATE TABLE IF NOT EXISTS `team_invite` (
  `id`           BIGINT      NOT NULL AUTO_INCREMENT,
  `room_id`      BIGINT      NOT NULL,
  `from_user_id` BIGINT      NOT NULL,
  `to_user_id`   BIGINT      NOT NULL,
  `status`       VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/accepted/rejected',
  `create_time`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ti_to` (`to_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联队邀请表';

-- 房间频道（聊天 / 军令 / 战报）
CREATE TABLE IF NOT EXISTS `team_message` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `room_id`     BIGINT       NOT NULL,
  `user_id`     BIGINT       DEFAULT NULL,
  `username`    VARCHAR(50)  DEFAULT NULL,
  `content`     VARCHAR(500) NOT NULL,
  `type`        VARCHAR(16)  NOT NULL DEFAULT 'chat' COMMENT 'chat/system/report',
  `create_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tmsg_room` (`room_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联队频道消息表';
