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

 Date: 09/10/2026 14:57:13
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '将军名号（登录账号）',
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '虎符密令（BCrypt 加密存储）',
  `faction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'han' COMMENT '阵营：han 汉室 / wei 曹魏 / shu 蜀汉 / wu 东吴',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入册时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '三国将军账号表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, '云长', '$2a$10$w/jfC0SXr1MMrO3pADd4ke0Z41SAW7UfxMl5BnQbgdhWVvArLS2LS', 'shu', '2026-10-09 14:17:36', '2026-10-09 14:17:36');
INSERT INTO `user` VALUES (2, '翼德', '$2a$10$mN1HplFEbR.jP/HW1tOqZe1ZKv7FkREZ7ADuEuRLDZ3HaZRwuKtTa', 'shu', '2026-10-09 14:18:56', '2026-10-09 14:18:56');
INSERT INTO `user` VALUES (3, '789', '$2a$10$qmR.HVwCFhzVPj8Apmz/5uOEvdAlyFTuPm4Cumzz15pN8SuAakHCi', 'han', '2026-10-09 14:19:39', '2026-10-09 14:19:39');
INSERT INTO `user` VALUES (4, '子龙', '$2a$10$/hB.MT8XrvO6ybDKvvRbUOl9rryCMgSzow5GnAYDd9/BYOhiVA9Wy', 'shu', '2026-10-09 14:22:48', '2026-10-09 14:22:48');
INSERT INTO `user` VALUES (5, '1234', '$2a$10$3HgNPOohTagtPONQMtT/1evOj30dijbFaLiK8fCTYLb62nU/ggvAi', 'han', '2026-10-09 14:37:23', '2026-10-09 14:37:23');

SET FOREIGN_KEY_CHECKS = 1;
