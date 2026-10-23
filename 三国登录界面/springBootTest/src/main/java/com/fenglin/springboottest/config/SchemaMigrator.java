package com.fenglin.springboottest.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 在线加列：给既有表补充新字段。
 *
 * <p>schema.sql 里的 CREATE TABLE 是幂等的，但 MySQL 不支持 ADD COLUMN IF NOT EXISTS，
 * 直接写进 schema.sql 会让老库启动失败（continue-on-error=false）。
 * 因此这里先查 information_schema，缺哪一列才补哪一列，保证新老库都能直接启动。
 *
 * <p>必须早于 DemoDataSeeder 执行——种子数据要往新列里写值。
 */
@Slf4j
@Component
@Order(1)
public class SchemaMigrator implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public SchemaMigrator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        addColumn("hero", "hp", "INT DEFAULT NULL COMMENT '体力上限（烽烟三国杀，3-5）'");
        addColumn("hero", "skill_name", "VARCHAR(30) DEFAULT NULL COMMENT '武将技名称'");
        addColumn("hero", "skill_type", "VARCHAR(10) DEFAULT NULL COMMENT '武将技类型：常策/奇谋/应策/秘计'");
        addColumn("hero", "skill_desc", "VARCHAR(120) DEFAULT NULL COMMENT '武将技描述'");
    }

    /** 列不存在才 ALTER，已存在直接跳过 */
    private void addColumn(String table, String column, String definition) {
        try {
            Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS "
                            + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                    Integer.class, table, column);
            if (exists != null && exists > 0) {
                return;
            }
            jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
            log.info("已为表 {} 补充字段 {}", table, column);
        } catch (Exception e) {
            // 加列失败不阻断启动，只是游戏侧某些字段读不到
            log.warn("为表 {} 补充字段 {} 失败：{}", table, column, e.getMessage());
        }
    }
}
