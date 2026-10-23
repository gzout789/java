/*
 Navicat Premium Dump SQL

 Source Server         : test
 Source Server Type    : MySQL
 Source Server Version : 80039 (8.0.39)
 Source Host           : localhost:3306
 Source Schema         : sanguo

 Target Server Type    : MySQL
 Target Server Version : 80039 (8.0.39)
 File Encoding         : 65001

 Date: 23/10/2026 15:05:30
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for admin_user
-- ----------------------------
DROP TABLE IF EXISTS `admin_user`;
CREATE TABLE `admin_user`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '管理账号',
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '密码（BCrypt 密文）',
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'admin' COMMENT '角色：admin/editor',
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
  `last_login` datetime NULL DEFAULT NULL COMMENT '最近登录时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_admin_username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '后台管理账号表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of admin_user
-- ----------------------------
INSERT INTO `admin_user` VALUES (1, 'admin', '$2a$10$jLM5E.VmLHKA9g7v8Qpbq.mBEYvzwXv/CoLIre07R9graOQClFgK6', 'admin', '内置管理员', '2026-10-23 14:38:07', '2026-10-23 14:16:19');

-- ----------------------------
-- Table structure for hero
-- ----------------------------
DROP TABLE IF EXISTS `hero`;
CREATE TABLE `hero`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '姓名',
  `epithet` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '称号',
  `faction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'han' COMMENT '阵营：han/wei/shu/wu',
  `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '类型：君主/军师/猛将/统帅',
  `type_name` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '类型展示名',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '小传',
  `power` int NULL DEFAULT NULL COMMENT '武力',
  `leadership` int NULL DEFAULT NULL COMMENT '统率',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `hp` int NULL DEFAULT NULL COMMENT '体力上限（烽烟三国杀，3-5）',
  `skill_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '武将技名称',
  `skill_type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '武将技类型：常策/奇谋/应策/秘计',
  `skill_desc` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '武将技描述',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_faction`(`faction` ASC) USING BTREE,
  INDEX `idx_type`(`type` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 27 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '英雄榜武将表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of hero
-- ----------------------------
INSERT INTO `hero` VALUES (1, '曹操', '乱世奸雄', 'wei', '君主', '君主', '挟天子以令诸侯，横槊赋诗，气吞山河。', 72, 96, 1, 4, '挟主', '奇谋', '出牌阶段，弃一张手牌，命一名其他角色交出一张手牌');
INSERT INTO `hero` VALUES (2, '夏侯惇', '独眼苍狼', 'wei', '猛将', '猛将', '拔矢啖睛，性烈如火，曹营第一先锋。', 88, 82, 2, 4, '刚烈', '应策', '你受到创伤后，可对伤害来源造成 1 点创伤');
INSERT INTO `hero` VALUES (3, '张辽', '威震逍遥', 'wei', '统帅', '统帅', '八百破十万，威震逍遥津，江东小儿不敢夜啼。', 92, 95, 3, 4, '威震', '奇谋', '出牌阶段，弃一张手牌，令一名角色弃置一张手牌');
INSERT INTO `hero` VALUES (4, '许褚', '虎痴', 'wei', '猛将', '猛将', '力能倒拖牛尾，裸衣斗马超，护卫中军不离半步。', 96, 68, 4, 4, '裸衣', '奇谋', '弃一张手牌，本回合你的【击】创伤 +1');
INSERT INTO `hero` VALUES (5, '司马懿', '冢虎', 'wei', '军师', '军师', '鹰视狼顾，能忍者胜，终成三家归晋之基。', 63, 98, 5, 3, '反馈', '应策', '你受到创伤后，可获得伤害来源的一张手牌');
INSERT INTO `hero` VALUES (6, '郭嘉', '鬼才', 'wei', '军师', '军师', '算无遗策，十胜十败定北疆，惜天不假年。', 45, 88, 6, 3, '遗计', '应策', '你受到创伤后，可摸两张牌');
INSERT INTO `hero` VALUES (7, '关羽', '武圣', 'shu', '猛将', '猛将', '温酒斩华雄，过五关斩六将，义薄云天。', 97, 95, 7, 4, '武圣', '应策', '你可将任意一张手牌当作【击】使用');
INSERT INTO `hero` VALUES (8, '张飞', '万人敌', 'shu', '猛将', '猛将', '当阳桥头一声断喝，独退曹家百万兵。', 98, 85, 8, 4, '咆哮', '奇谋', '出牌阶段，你可额外使用一张【击】');
INSERT INTO `hero` VALUES (9, '赵云', '常山虎将', 'shu', '猛将', '猛将', '长坂坡七进七出，一身是胆，护主周全。', 96, 91, 9, 4, '龙胆', '应策', '你可将【挡】当【击】、【击】当【挡】使用');
INSERT INTO `hero` VALUES (10, '马超', '锦马超', 'shu', '猛将', '猛将', '西凉铁骑之子，杀得曹操割须弃袍。', 97, 88, 10, 4, '铁骑', '常策', '你计算攻击距离时无视目标的坚驹');
INSERT INTO `hero` VALUES (11, '黄忠', '老当益壮', 'shu', '猛将', '猛将', '定军山一箭斩夏侯，年近七旬仍开三石之弓。', 93, 86, 11, 4, '烈弓', '常策', '你的攻击距离 +1');
INSERT INTO `hero` VALUES (12, '诸葛亮', '卧龙', 'shu', '军师', '军师', '未出茅庐已知三分天下，鞠躬尽瘁死而后已。', 38, 95, 12, 3, '空城', '常策', '你没有手牌时，不能被【击】与【探囊】指定');
INSERT INTO `hero` VALUES (13, '周瑜', '美周郎', 'wu', '军师', '军师', '赤壁一把火，烧尽曹军八十万，雄姿英发。', 71, 93, 13, 3, '英姿', '奇谋', '出牌阶段，你可摸一张牌（每回合限一次）');
INSERT INTO `hero` VALUES (14, '吕蒙', '吴下阿蒙', 'wu', '统帅', '统帅', '士别三日刮目相看，白衣渡江取荆州。', 78, 91, 14, 4, '克己', '常策', '若本回合未使用过【击】，收兵阶段不必弃牌');
INSERT INTO `hero` VALUES (15, '陆逊', '江东儒将', 'wu', '军师', '军师', '火烧连营七百里，书生亦可破枭雄。', 60, 94, 15, 3, '谦逊', '常策', '你不能成为【探囊】与【困局】的目标');
INSERT INTO `hero` VALUES (16, '甘宁', '锦帆贼', 'wu', '猛将', '猛将', '百骑劫魏营，铃响处无人敢挡。', 94, 79, 16, 4, '奇袭', '奇谋', '你可将一张黑色手牌当作【探囊】使用');
INSERT INTO `hero` VALUES (17, '太史慈', '神射', 'wu', '猛将', '猛将', '猿臂善射，箭无虚发，北海突围救孔融。', 92, 83, 17, 4, '神射', '应策', '你的【击】造成创伤后，你摸一张牌');
INSERT INTO `hero` VALUES (18, '孙权', '碧眼儿', 'wu', '君主', '君主', '坐断东南战未休，生子当如孙仲谋。', 66, 89, 18, 4, '制衡', '奇谋', '弃置任意数量手牌，再摸等量的牌（每回合限一次）');
INSERT INTO `hero` VALUES (19, '吕布', '飞将', 'han', '猛将', '猛将', '人中吕布，马中赤兔，方天画戟无人可挡。', 100, 87, 19, 5, '无双', '应策', '你的【击】需两张【挡】才能抵消');
INSERT INTO `hero` VALUES (20, '董卓', '西凉狼', 'han', '君主', '君主', '废立天子，焚毁洛阳，暴虐终致身死灯灭。', 87, 84, 20, 5, '暴虐', '应策', '你受到创伤后，摸一张牌');
INSERT INTO `hero` VALUES (21, '袁绍', '四世三公', 'han', '君主', '君主', '门生故吏遍天下，可惜好谋无断。', 68, 86, 21, 4, '乱击', '秘计', '一局一次：弃两张手牌，对场上其他角色各造成 1 点创伤');
INSERT INTO `hero` VALUES (22, '公孙瓒', '白马将军', 'han', '统帅', '统帅', '白马义从踏塞北，声名远震乌桓。', 84, 88, 22, 4, '白马', '常策', '你计算与其他角色的距离 -1');

-- ----------------------------
-- Table structure for news
-- ----------------------------
DROP TABLE IF EXISTS `news`;
CREATE TABLE `news`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `content` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '快报正文',
  `category` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '类别',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '烽火快报表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of news
-- ----------------------------
INSERT INTO `news` VALUES (1, '江北探马回报：曹军辎重营西移三十里，似有退兵之意。', '军情', 1);
INSERT INTO `news` VALUES (2, '江东水师新造艨艟二十艘，已入濡须口。', '军情', 2);
INSERT INTO `news` VALUES (3, '斥候于山谷间发现不明营火，疑为敌军前锋。', '军情', 3);
INSERT INTO `news` VALUES (4, '朝廷下诏加封各路诸侯，使者已至许都。', '朝野', 4);
INSERT INTO `news` VALUES (5, '西凉马腾遣使入京，贡良马百匹。', '朝野', 5);
INSERT INTO `news` VALUES (6, '蜀中米价回落三成，百姓争相入市。', '朝野', 6);
INSERT INTO `news` VALUES (7, '夜观天象，紫微星旁有客星犯位，太史令称主兵事。', '异象', 7);
INSERT INTO `news` VALUES (8, '汉水暴涨，渡口浮桥被冲断，两岸商旅滞留。', '异象', 8);

-- ----------------------------
-- Table structure for recruit
-- ----------------------------
DROP TABLE IF EXISTS `recruit`;
CREATE TABLE `recruit`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '招募者（将军账号ID）',
  `hero_id` bigint NOT NULL COMMENT '被招募的武将ID',
  `cost` int NOT NULL DEFAULT 0 COMMENT '招募时耗费军饷（石）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入帐时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_hero`(`user_id` ASC, `hero_id` ASC) USING BTREE,
  INDEX `idx_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '点将台招募记录表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of recruit
-- ----------------------------
INSERT INTO `recruit` VALUES (1, 1, 12, 765, '2026-10-23 14:10:44');
INSERT INTO `recruit` VALUES (2, 1, 11, 995, '2026-10-23 14:10:49');
INSERT INTO `recruit` VALUES (3, 1, 8, 1015, '2026-10-23 14:10:57');
INSERT INTO `recruit` VALUES (4, 1, 10, 1025, '2026-10-23 14:10:58');
INSERT INTO `recruit` VALUES (5, 1, 9, 1035, '2026-10-23 14:10:59');
INSERT INTO `recruit` VALUES (6, 1, 7, 1060, '2026-10-23 14:10:59');
INSERT INTO `recruit` VALUES (7, 1, 6, 1150, '2026-10-23 14:10:59');

-- ----------------------------
-- Table structure for task
-- ----------------------------
DROP TABLE IF EXISTS `task`;
CREATE TABLE `task`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '要务内容',
  `done` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否办毕',
  `category` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '类别',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '军机要务表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of task
-- ----------------------------
INSERT INTO `task` VALUES (1, '卯时点卯，清点中军帐下人马', 1, '军务', 1);
INSERT INTO `task` VALUES (2, '校场操演枪阵，验收新募士卒', 0, '军务', 2);
INSERT INTO `task` VALUES (3, '押运粮草三十车至前线大营', 0, '军务', 3);
INSERT INTO `task` VALUES (4, '探马回报曹军动向，重绘行军图', 0, '军务', 4);
INSERT INTO `task` VALUES (5, '修缮城防，补筑北门箭楼', 0, '内政', 5);
INSERT INTO `task` VALUES (6, '核计本月军饷钱粮，造册上报', 1, '内政', 6);
INSERT INTO `task` VALUES (7, '犒赏三军，设宴安抚新降之将', 0, '内政', 7);
INSERT INTO `task` VALUES (8, '遣使赴江东，商议互市通商', 0, '外交', 8);

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '将军名号（登录账号）',
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '虎符密令（BCrypt 密文）',
  `faction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'han' COMMENT '阵营：han/wei/shu/wu',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入册时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '三国将军账号表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, '云长', '$2a$10$R5iY/eZ8IdGs49.EIiqh/uBnmR2Hdyr43K.nFdbtVbG2N0qgxRAMm', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (2, '翼德', '$2a$10$AnBfDW1BW7lJolQg.cYEguQrA10/L5gzXQjfZT55RfK2MjCQ0ds5K', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (3, '子龙', '$2a$10$Znz0Lt89UnOiBpgBFG5o9.ganNoxeGawi9SgtC2tXVPeuRBvkB7g2', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (4, '孟德', '$2a$10$z4M8XjpIL.vF6OnQaNdoV.mIZurlToKumqELcvF0O.PALHCxwzfsm', 'wei', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (5, '仲谋', '$2a$10$ja9r14mt2WMLE.AbDKZ08uT6MoEvR1LlyxqopbgcXClfPGdvmSqB2', 'wu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');

SET FOREIGN_KEY_CHECKS = 1;
