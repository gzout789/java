package com.fenglin.springboottest.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 同袍系统公共工具：账号 ID 互查、好友判定、阵营名、数值转换。
 * 所有社交接口都通过拦截器写入的 currentUser（名号）定位当前将军。
 */
@Component
public class SocialSupport {

    private static final Map<String, String> FACTION_NAMES = Map.of(
            "han", "汉室",
            "wei", "曹魏",
            "shu", "蜀汉",
            "wu", "东吴"
    );

    private final JdbcTemplate jdbc;

    public SocialSupport(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static String factionName(String key) {
        return FACTION_NAMES.getOrDefault(key == null ? "" : key, "汉室");
    }

    public static long toLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    public static int toInt(Object value) {
        return (int) toLong(value);
    }

    public Long userId(String username) {
        if (username == null || username.isEmpty()) return null;
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM `user` WHERE username = ?", Long.class, username);
        return ids.isEmpty() ? null : ids.get(0);
    }

    public String username(Long id) {
        if (id == null) return "";
        List<String> names = jdbc.queryForList(
                "SELECT username FROM `user` WHERE id = ?", String.class, id);
        return names.isEmpty() ? "" : names.get(0);
    }

    public boolean areFriends(Long a, Long b) {
        if (a == null || b == null) return false;
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM friendship WHERE user_id = ? AND friend_id = ?",
                Long.class, a, b);
        return count != null && count > 0;
    }

    /** 当前登录名号必须能在账号表中查到，否则一律视为凭信失效 */
    public Long requireId(String username) {
        Long id = userId(username);
        if (id == null) throw new IllegalArgumentException("凭信已失效，请重新点兵入帐");
        return id;
    }

    /** 统一裁剪正文，避免超长内容直接撞上 varchar 长度报错 */
    public static String cleanContent(String raw, int max) {
        String text = raw == null ? "" : raw.trim();
        if (text.isEmpty()) throw new IllegalArgumentException("话不可为空");
        return text.length() > max ? text.substring(0, max) : text;
    }
}
