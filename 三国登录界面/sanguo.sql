/*
 Navicat Premium Dump SQL

 Source Server         : localhost_3306
 Source Server Type    : MySQL
 Source Server Version : 80046 (8.0.46)
 Source Host           : localhost:3306
 Source Schema         : sanguo

 Target Server Type    : MySQL
 Target Server Version : 80046 (8.0.46)
 File Encoding         : 65001

 Date: 11/11/2026 16:53:55
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
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '后台管理账号表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of admin_user
-- ----------------------------
INSERT INTO `admin_user` VALUES (1, '管理员', '$2a$10$cqBRwa3gnqQt/NZLtBuNW./g32EcAqTWO/PiCn7ozNf2G7ggMhRTK', 'admin', '内置管理员', '2026-11-11 13:26:13', '2026-10-23 14:16:19');

-- ----------------------------
-- Table structure for friend_message
-- ----------------------------
DROP TABLE IF EXISTS `friend_message`;
CREATE TABLE `friend_message`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `from_user_id` bigint NOT NULL,
  `to_user_id` bigint NOT NULL,
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_fm_pair`(`from_user_id` ASC, `to_user_id` ASC, `id` ASC) USING BTREE,
  INDEX `idx_fm_to`(`to_user_id` ASC, `is_read` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '同袍私信表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of friend_message
-- ----------------------------

-- ----------------------------
-- Table structure for friend_request
-- ----------------------------
DROP TABLE IF EXISTS `friend_request`;
CREATE TABLE `friend_request`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `from_user_id` bigint NOT NULL COMMENT '发起者',
  `to_user_id` bigint NOT NULL COMMENT '接收者',
  `message` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '附言',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/accepted/rejected',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `handle_time` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_fr_to`(`to_user_id` ASC, `status` ASC) USING BTREE,
  INDEX `idx_fr_from`(`from_user_id` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '同袍结交帖表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of friend_request
-- ----------------------------

-- ----------------------------
-- Table structure for friendship
-- ----------------------------
DROP TABLE IF EXISTS `friendship`;
CREATE TABLE `friendship`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `friend_id` bigint NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_friend_pair`(`user_id` ASC, `friend_id` ASC) USING BTREE,
  INDEX `idx_fs_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '同袍好友关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of friendship
-- ----------------------------

-- ----------------------------
-- Table structure for gacha_log
-- ----------------------------
DROP TABLE IF EXISTS `gacha_log`;
CREATE TABLE `gacha_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '抽卡者（将军账号ID）',
  `hero_id` bigint NULL DEFAULT NULL COMMENT '抽中的武将ID',
  `cost` int NOT NULL DEFAULT 0 COMMENT '本次消耗军饷（石）',
  `refund` int NOT NULL DEFAULT 0 COMMENT '重复返还军饷（石）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽卡时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_gacha_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '抽卡流水表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of gacha_log
-- ----------------------------
INSERT INTO `gacha_log` VALUES (1, 7, 13, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (2, 7, 7, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (3, 7, 7, 450, 795, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (4, 7, 7, 450, 795, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (5, 7, 3, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (6, 7, 19, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (7, 7, 29, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (8, 7, 19, 450, 517, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (9, 7, 16, 450, 0, '2026-11-09 09:20:01');
INSERT INTO `gacha_log` VALUES (10, 7, 20, 450, 0, '2026-11-09 09:20:01');

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
) ENGINE = InnoDB AUTO_INCREMENT = 31 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '英雄榜武将表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of hero
-- ----------------------------
INSERT INTO `hero` VALUES (1, '曹操', '乱世奸雄', 'wei', '君主', '君主', '挟天子以令诸侯，横槊赋诗，气吞山河。', 72, 96, 1, 4, '收编', '应策', '你受到创伤后，获得伤害来源的一张手牌');
INSERT INTO `hero` VALUES (2, '夏侯惇', '独眼苍狼', 'wei', '猛将', '猛将', '拔矢啖睛，性烈如火，曹营第一先锋。', 88, 82, 2, 4, '拔矢啖睛', '应策', '你受到【击】的创伤后，令来源弃两张手牌或受 1 点创伤');
INSERT INTO `hero` VALUES (3, '张辽', '威震逍遥', 'wei', '统帅', '统帅', '八百破十万，威震逍遥津，江东小儿不敢夜啼。', 92, 95, 3, 4, '威震', '奇谋', '出牌阶段，弃一张手牌，令一名角色弃置一张手牌');
INSERT INTO `hero` VALUES (4, '许褚', '虎痴', 'wei', '猛将', '猛将', '力能倒拖牛尾，裸衣斗马超，护卫中军不离半步。', 96, 68, 4, 4, '裸衣', '奇谋', '弃一张手牌，本回合你的【击】创伤 +1');
INSERT INTO `hero` VALUES (5, '司马懿', '冢虎', 'wei', '军师', '军师', '鹰视狼顾，能忍者胜，终成三家归晋之基。', 63, 98, 5, 3, '鬼才', '应策', '任意角色的判定牌生效前，你可打出一张手牌代替之');
INSERT INTO `hero` VALUES (6, '郭嘉', '鬼才', 'wei', '军师', '军师', '算无遗策，十胜十败定北疆，惜天不假年。', 45, 88, 6, 3, '遗计', '应策', '你受到创伤后，可摸两张牌');
INSERT INTO `hero` VALUES (7, '关羽', '武圣', 'shu', '猛将', '猛将', '温酒斩华雄，过五关斩六将，义薄云天。', 97, 95, 7, 4, '武圣', '应策', '你可将任意一张手牌当作【击】使用');
INSERT INTO `hero` VALUES (8, '张飞', '万人敌', 'shu', '猛将', '猛将', '当阳桥头一声断喝，独退曹家百万兵。', 98, 85, 8, 4, '咆哮', '奇谋', '出牌阶段，你可额外使用一张【击】');
INSERT INTO `hero` VALUES (9, '赵云', '常山虎将', 'shu', '猛将', '猛将', '长坂坡七进七出，一身是胆，护主周全。', 96, 91, 9, 4, '龙胆', '应策', '你可将【挡】当【击】、【击】当【挡】使用');
INSERT INTO `hero` VALUES (10, '马超', '锦马超', 'shu', '猛将', '猛将', '西凉铁骑之子，杀得曹操割须弃袍。', 97, 88, 10, 4, '铁骑', '常策', '你计算攻击距离时无视目标的坚驹');
INSERT INTO `hero` VALUES (11, '黄忠', '老当益壮', 'shu', '猛将', '猛将', '定军山一箭斩夏侯，年近七旬仍开三石之弓。', 93, 86, 11, 4, '烈弓', '常策', '你的攻击距离 +1');
INSERT INTO `hero` VALUES (12, '诸葛亮', '卧龙', 'shu', '军师', '军师', '未出茅庐已知三分天下，鞠躬尽瘁死而后已。', 38, 95, 12, 3, '空城', '常策', '你没有手牌时，不能被【击】与【探囊】指定');
INSERT INTO `hero` VALUES (13, '周瑜', '美周郎', 'wu', '军师', '军师', '赤壁一把火，烧尽曹军八十万，雄姿英发。', 71, 93, 13, 3, '英姿', '奇谋', '出牌阶段，你可摸一张牌（每回合限一次）');
INSERT INTO `hero` VALUES (14, '吕蒙', '吴下阿蒙', 'wu', '统帅', '统帅', '士别三日刮目相看，白衣渡江取荆州。', 78, 91, 14, 4, '克己', '常策', '若本回合未使用过【击】，收兵阶段不必弃牌');
INSERT INTO `hero` VALUES (15, '陆逊', '江东儒将', 'wu', '军师', '军师', '火烧连营七百里，书生亦可破枭雄。', 60, 94, 15, 3, '谦冲', '常策', '你不能成为【探囊】【困局】【惑敌】的目标；计略创伤 -1');
INSERT INTO `hero` VALUES (16, '甘宁', '锦帆贼', 'wu', '猛将', '猛将', '百骑劫魏营，铃响处无人敢挡。', 94, 79, 16, 4, '奇袭', '奇谋', '你可将一张黑色手牌当作【探囊】使用');
INSERT INTO `hero` VALUES (17, '太史慈', '神射', 'wu', '猛将', '猛将', '猿臂善射，箭无虚发，北海突围救孔融。', 92, 83, 17, 4, '神射', '应策', '你的【击】造成创伤后，你摸一张牌');
INSERT INTO `hero` VALUES (18, '孙权', '碧眼儿', 'wu', '君主', '君主', '坐断东南战未休，生子当如孙仲谋。', 66, 89, 18, 4, '制衡', '奇谋', '弃置任意数量手牌，再摸等量的牌（每回合限一次）');
INSERT INTO `hero` VALUES (19, '吕布', '飞将', 'han', '猛将', '猛将', '人中吕布，马中赤兔，方天画戟无人可挡。', 100, 87, 19, 4, '无双', '应策', '你的【击】需两张【挡】才能抵消');
INSERT INTO `hero` VALUES (20, '董卓', '西凉狼', 'han', '君主', '君主', '废立天子，焚毁洛阳，暴虐终致身死灯灭。', 87, 84, 20, 5, '暴虐', '应策', '你受到创伤后，摸一张牌');
INSERT INTO `hero` VALUES (21, '袁绍', '四世三公', 'han', '君主', '君主', '门生故吏遍天下，可惜好谋无断。', 68, 86, 21, 4, '乱击', '秘计', '一局一次：弃两张手牌，对场上其他角色各造成 1 点创伤');
INSERT INTO `hero` VALUES (22, '公孙瓒', '白马将军', 'han', '统帅', '统帅', '白马义从踏塞北，声名远震乌桓。', 84, 88, 22, 4, '白马', '常策', '你计算与其他角色的距离 -1');
INSERT INTO `hero` VALUES (27, '刘备', '昭烈仁主', 'shu', '君主', '君主', '桃园结义得人死力，携民渡江而不弃，以仁德立于乱世。', 73, 88, 23, 5, '仁德', '奇谋', '出牌阶段限一次：弃两张手牌交给一名其他角色，你回复 1 点体力');
INSERT INTO `hero` VALUES (28, '孙尚香', '弓腰姬', 'wu', '猛将', '猛将', '才捷刚猛有诸兄之风，侍婢百人皆执刀侍立。', 82, 75, 24, 3, '枭姬', '应策', '你失去装备区一张牌后，摸两张牌');
INSERT INTO `hero` VALUES (29, '貂蝉', '闭月', 'han', '军师', '军师', '连环美人计离间董卓吕布，巾帼胜过十万兵。', 68, 70, 25, 3, '离间', '奇谋', '出牌阶段限一次：令两名其他角色互出【击】，不出者失去 1 点体力');
INSERT INTO `hero` VALUES (30, '华佗', '神医', 'han', '军师', '军师', '刮骨疗毒，青囊济世，妙手回春医者仁心。', 40, 55, 26, 3, '青囊', '奇谋', '出牌阶段限两次：弃一张手牌，令一名已受伤角色回复 1 点体力');

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
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '烽火快报表' ROW_FORMAT = DYNAMIC;

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
-- Table structure for quiz_earning
-- ----------------------------
DROP TABLE IF EXISTS `quiz_earning`;
CREATE TABLE `quiz_earning`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '答题者（将军账号ID）',
  `question_id` bigint NOT NULL COMMENT '题目ID',
  `reward` int NOT NULL DEFAULT 0 COMMENT '本次获得军饷（石）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '答题时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_question`(`user_id` ASC, `question_id` ASC) USING BTREE,
  INDEX `idx_quiz_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 24 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '答题军饷收益流水表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of quiz_earning
-- ----------------------------
INSERT INTO `quiz_earning` VALUES (1, 1, 1, 100, '2026-11-06 09:37:30');
INSERT INTO `quiz_earning` VALUES (2, 1, 2, 100, '2026-11-06 09:37:34');
INSERT INTO `quiz_earning` VALUES (3, 1, 3, 100, '2026-11-06 09:37:40');
INSERT INTO `quiz_earning` VALUES (4, 7, 1, 100, '2026-11-09 09:44:43');
INSERT INTO `quiz_earning` VALUES (5, 7, 2, 100, '2026-11-09 09:44:56');
INSERT INTO `quiz_earning` VALUES (6, 7, 3, 100, '2026-11-09 09:45:04');
INSERT INTO `quiz_earning` VALUES (7, 7, 4, 100, '2026-11-09 09:45:22');
INSERT INTO `quiz_earning` VALUES (8, 7, 5, 100, '2026-11-09 09:45:37');
INSERT INTO `quiz_earning` VALUES (9, 7, 6, 100, '2026-11-09 09:45:51');
INSERT INTO `quiz_earning` VALUES (10, 7, 7, 100, '2026-11-09 09:46:04');
INSERT INTO `quiz_earning` VALUES (11, 1, 4, 100, '2026-11-11 13:09:07');
INSERT INTO `quiz_earning` VALUES (12, 1, 6, 100, '2026-11-11 13:23:57');
INSERT INTO `quiz_earning` VALUES (13, 1, 7, 100, '2026-11-11 13:24:03');
INSERT INTO `quiz_earning` VALUES (14, 1, 8, 100, '2026-11-11 13:24:08');
INSERT INTO `quiz_earning` VALUES (15, 1, 9, 100, '2026-11-11 13:24:17');
INSERT INTO `quiz_earning` VALUES (16, 1, 10, 100, '2026-11-11 13:24:23');
INSERT INTO `quiz_earning` VALUES (17, 1, 11, 100, '2026-11-11 13:24:30');
INSERT INTO `quiz_earning` VALUES (18, 1, 13, 100, '2026-11-11 13:24:42');
INSERT INTO `quiz_earning` VALUES (19, 1, 14, 100, '2026-11-11 13:24:48');
INSERT INTO `quiz_earning` VALUES (20, 1, 16, 100, '2026-11-11 13:25:00');
INSERT INTO `quiz_earning` VALUES (21, 1, 17, 100, '2026-11-11 13:25:08');
INSERT INTO `quiz_earning` VALUES (22, 1, 18, 100, '2026-11-11 13:25:13');
INSERT INTO `quiz_earning` VALUES (23, 1, 19, 100, '2026-11-11 13:25:19');

-- ----------------------------
-- Table structure for quiz_question
-- ----------------------------
DROP TABLE IF EXISTS `quiz_question`;
CREATE TABLE `quiz_question`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `question` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '题目正文',
  `option_a` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '选项A',
  `option_b` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '选项B',
  `option_c` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '选项C',
  `option_d` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '选项D',
  `answer` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '正确答案 A/B/C/D',
  `explanation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '知识点解析',
  `reward` int NOT NULL DEFAULT 100 COMMENT '答对奖励军饷（石）',
  `category` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '分类：典故/人物/地理/兵制',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 21 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '学识问道题库表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of quiz_question
-- ----------------------------
INSERT INTO `quiz_question` VALUES (1, '刘备、关羽、张飞结义的桃园，位于今天的哪一省？', '河北省', '河南省', '山东省', '湖北省', 'A', '桃园结义相传发生在涿郡（今河北省涿州市）。', 100, '典故', 1);
INSERT INTO `quiz_question` VALUES (2, '「三顾茅庐」中，刘备拜访的是哪位卧龙先生？', '庞统', '诸葛亮', '司马徽', '徐庶', 'B', '刘备三顾茅庐请出诸葛亮，得《隆中对》定三分之策。', 100, '典故', 2);
INSERT INTO `quiz_question` VALUES (3, '「温酒斩华雄」说的是哪位猛将？', '关羽', '张飞', '赵云', '吕布', 'A', '关羽出战前曹操温酒为敬，斩华雄归来酒尚温。', 100, '人物', 3);
INSERT INTO `quiz_question` VALUES (4, '赤壁之战中，曹军与孙刘联军对峙的江流是？', '黄河', '汉水', '长江', '淮河', 'C', '赤壁位于今湖北，是长江沿岸的一场水战。', 100, '地理', 4);
INSERT INTO `quiz_question` VALUES (5, '「草船借箭」的主角，用了几日借得十万支箭？', '一日', '三日', '五日', '七日', 'B', '诸葛亮应周瑜之约，借大雾三日之内草船得箭十万。', 100, '典故', 5);
INSERT INTO `quiz_question` VALUES (6, '被后世尊为「武圣」，与文圣孔子并称的是？', '岳飞', '关羽', '张飞', '赵云', 'B', '关羽以「义」名垂青史，后世尊为武圣、关帝。', 100, '人物', 6);
INSERT INTO `quiz_question` VALUES (7, '「隆中对」提出的战略是：先取何处为根据地？', '益州', '荆州', '扬州', '凉州', 'B', '诸葛亮建议先取荆州为家，再图益州，三分天下。', 100, '典故', 7);
INSERT INTO `quiz_question` VALUES (8, '曹操「挟天子以令诸侯」，所挟的是哪位皇帝？', '汉桓帝', '汉灵帝', '汉献帝', '汉少帝', 'C', '曹操迎汉献帝至许都，自此把持朝政。', 100, '人物', 8);
INSERT INTO `quiz_question` VALUES (9, '「既生瑜，何生亮」是周瑜临终前的感慨，指的是谁？', '司马懿', '诸葛亮', '庞统', '陆逊', 'B', '周瑜屡为诸葛亮所制，病逝前发出此叹。', 100, '典故', 9);
INSERT INTO `quiz_question` VALUES (10, '赤壁之战孙刘联军的主帅中，吴军由谁统率？', '鲁肃', '周瑜', '陆逊', '吕蒙', 'B', '周瑜为吴军大都督，黄盖行诈降火攻之策。', 100, '人物', 10);
INSERT INTO `quiz_question` VALUES (11, '「刮骨疗毒」为关羽医治的神医是？', '张仲景', '华佗', '扁鹊', '皇甫谧', 'B', '关羽臂中毒箭，华佗刮骨疗毒，其谈笑自若。', 100, '典故', 11);
INSERT INTO `quiz_question` VALUES (12, '「单刀赴会」中，关羽孤身前往会见的是？', '曹操', '孙权', '周瑜', '鲁肃', 'D', '关羽单刀赴会，与鲁肃就荆州之争交锋。', 100, '典故', 12);
INSERT INTO `quiz_question` VALUES (13, '三国中「赤兔马」先后是吕布与谁的坐骑？', '张飞', '关羽', '赵云', '马超', 'B', '赤兔马先属吕布，后归关羽，关羽败亡后绝食而死。', 100, '人物', 13);
INSERT INTO `quiz_question` VALUES (14, '「空城计」中，诸葛亮在城头抚琴，吓退了谁的追兵？', '司马懿', '曹真', '司马昭', '张郃', 'A', '传说诸葛亮空城弹琴，司马懿疑有伏兵而退。', 100, '典故', 14);
INSERT INTO `quiz_question` VALUES (15, '「鞠躬尽瘁，死而后已」出自诸葛亮的哪篇文章？', '《出师表》', '《隆中对》', '《诫子书》', '《后出师表》', 'D', '此句出自《后出师表》，是诸葛亮自明心志之语。', 100, '典故', 15);
INSERT INTO `quiz_question` VALUES (16, '三国时期蜀汉的都城是今天的哪座城市？', '西安', '成都', '洛阳', '南京', 'B', '刘备在成都称帝，蜀汉以成都为都。', 100, '地理', 16);
INSERT INTO `quiz_question` VALUES (17, '「生子当如孙仲谋」是谁对孙权（字仲谋）的赞叹？', '刘备', '曹操', '袁绍', '司马懿', 'B', '曹操见孙权军容整肃，叹曰「生子当如孙仲谋」。', 100, '人物', 17);
INSERT INTO `quiz_question` VALUES (18, '「过五关斩六将」是关羽千里走单骑投奔谁？', '刘备', '曹操', '孙权', '诸葛亮', 'A', '关羽得知刘备下落，过五关斩六将前去相会。', 100, '典故', 18);
INSERT INTO `quiz_question` VALUES (19, '「白衣渡江」奇袭荆州、擒杀关羽的是哪位东吴将领？', '陆逊', '吕蒙', '周瑜', '鲁肃', 'B', '吕蒙令士卒白衣扮商贾渡江，奇袭荆州。', 100, '人物', 19);
INSERT INTO `quiz_question` VALUES (20, '魏、蜀、吴三国鼎立的局面，以哪一战役为确立的标志？', '官渡之战', '赤壁之战', '夷陵之战', '汉中之战', 'B', '赤壁之战后曹操无力南下，奠定了三分天下的格局。', 100, '兵制', 20);

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
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '点将台招募记录表' ROW_FORMAT = DYNAMIC;

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
INSERT INTO `recruit` VALUES (8, 1, 30, 870, '2026-10-30 14:43:25');
INSERT INTO `recruit` VALUES (9, 7, 13, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (10, 7, 7, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (11, 7, 3, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (12, 7, 19, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (13, 7, 29, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (14, 7, 16, 0, '2026-11-09 09:20:01');
INSERT INTO `recruit` VALUES (15, 7, 20, 0, '2026-11-09 09:20:01');

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
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '军机要务表' ROW_FORMAT = DYNAMIC;

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
-- Table structure for team_invite
-- ----------------------------
DROP TABLE IF EXISTS `team_invite`;
CREATE TABLE `team_invite`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `room_id` bigint NOT NULL,
  `from_user_id` bigint NOT NULL,
  `to_user_id` bigint NOT NULL,
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/accepted/rejected',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_ti_to`(`to_user_id` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '联队邀请表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_invite
-- ----------------------------

-- ----------------------------
-- Table structure for team_member
-- ----------------------------
DROP TABLE IF EXISTS `team_member`;
CREATE TABLE `team_member`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `room_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `join_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_team_member`(`room_id` ASC, `user_id` ASC) USING BTREE,
  INDEX `idx_tm_user`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '联队成员表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_member
-- ----------------------------

-- ----------------------------
-- Table structure for team_message
-- ----------------------------
DROP TABLE IF EXISTS `team_message`;
CREATE TABLE `team_message`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `room_id` bigint NOT NULL,
  `user_id` bigint NULL DEFAULT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `type` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'chat' COMMENT 'chat/system/report',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tmsg_room`(`room_id` ASC, `id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 15 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '联队频道消息表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_message
-- ----------------------------

-- ----------------------------
-- Table structure for team_room
-- ----------------------------
DROP TABLE IF EXISTS `team_room`;
CREATE TABLE `team_room`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '房号（邀请码）',
  `name` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '同袍联队',
  `leader_id` bigint NOT NULL COMMENT '房主',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'waiting' COMMENT 'waiting/playing/closed',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `start_time` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_team_code`(`code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '烽烟联队房间表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of team_room
-- ----------------------------

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
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '三国将军账号表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, '云长', '$2a$10$R5iY/eZ8IdGs49.EIiqh/uBnmR2Hdyr43K.nFdbtVbG2N0qgxRAMm', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (2, '翼德', '$2a$10$AnBfDW1BW7lJolQg.cYEguQrA10/L5gzXQjfZT55RfK2MjCQ0ds5K', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (3, '子龙', '$2a$10$Znz0Lt89UnOiBpgBFG5o9.ganNoxeGawi9SgtC2tXVPeuRBvkB7g2', 'shu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (4, '孟德', '$2a$10$z4M8XjpIL.vF6OnQaNdoV.mIZurlToKumqELcvF0O.PALHCxwzfsm', 'wei', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (5, '仲谋', '$2a$10$ja9r14mt2WMLE.AbDKZ08uT6MoEvR1LlyxqopbgcXClfPGdvmSqB2', 'wu', '2026-10-23 14:07:04', '2026-10-23 14:07:04');
INSERT INTO `user` VALUES (6, '以德', '$2a$10$8NFmHhfEcFjusoY4DFBdz.DsHvJ4w6cRmAVLGEeP2OzjcveDo5XU.', 'han', '2026-11-02 09:55:04', '2026-11-02 09:55:04');
INSERT INTO `user` VALUES (7, '我文', '$2a$10$LDaa5Rl7T6PeBeB.9mNDxu6QJZhGmXkG/9DN/r1CPr/v/zxbFtPgu', 'wu', '2026-11-09 09:19:33', '2026-11-11 13:26:52');

SET FOREIGN_KEY_CHECKS = 1;
