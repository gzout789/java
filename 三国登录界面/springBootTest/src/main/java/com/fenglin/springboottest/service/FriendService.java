package com.fenglin.springboottest.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 同袍结交 + 私信往来。
 * 业务校验不通过时抛 IllegalArgumentException，由 Controller 统一转成 ApiResult.fail。
 */
@Service
public class FriendService {

    private final JdbcTemplate jdbc;
    private final SocialSupport support;

    public FriendService(JdbcTemplate jdbc, SocialSupport support) {
        this.jdbc = jdbc;
        this.support = support;
    }

    /** 一次拿齐好友、待处理结交帖、未读总数，前端轮询此接口即可 */
    public Map<String, Object> overview(String me) {
        Long meId = support.requireId(me);

        List<Map<String, Object>> friends = jdbc.queryForList(
                "SELECT u.username AS username, u.faction AS faction, "
                        + "(SELECT COUNT(*) FROM friend_message m WHERE m.from_user_id = f.friend_id "
                        + "  AND m.to_user_id = f.user_id AND m.is_read = 0) AS unread "
                        + "FROM friendship f JOIN `user` u ON u.id = f.friend_id "
                        + "WHERE f.user_id = ? ORDER BY u.username", meId);
        int unreadTotal = 0;
        for (Map<String, Object> f : friends) {
            int unread = SocialSupport.toInt(f.get("unread"));
            f.put("unread", unread);
            f.put("factionName", SocialSupport.factionName((String) f.get("faction")));
            unreadTotal += unread;
        }

        List<Map<String, Object>> requests = jdbc.queryForList(
                "SELECT r.id AS id, uf.username AS fromUsername, ut.username AS toUsername, "
                        + "IFNULL(r.message, '') AS message, r.status AS status, "
                        + "DATE_FORMAT(r.create_time, '%Y-%m-%d %H:%i') AS time, "
                        + "CASE WHEN r.to_user_id = ? THEN 'in' ELSE 'out' END AS direction "
                        + "FROM friend_request r "
                        + "JOIN `user` uf ON uf.id = r.from_user_id "
                        + "JOIN `user` ut ON ut.id = r.to_user_id "
                        + "WHERE (r.to_user_id = ? OR r.from_user_id = ?) AND r.status = 'pending' "
                        + "ORDER BY r.id DESC", meId, meId, meId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("friends", friends);
        data.put("requests", requests);
        data.put("unreadTotal", unreadTotal);
        return data;
    }

    /** 按名号模糊搜人，附带「是否已是同袍 / 是否有待处理帖」标记 */
    public List<Map<String, Object>> search(String me, String keyword) {
        Long meId = support.requireId(me);
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.isEmpty()) return Collections.emptyList();

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.username AS username, u.faction AS faction, "
                        + "(SELECT COUNT(*) FROM friendship f WHERE f.user_id = ? AND f.friend_id = u.id) AS isFriend, "
                        + "(SELECT COUNT(*) FROM friend_request r WHERE r.status = 'pending' AND "
                        + "  ((r.from_user_id = ? AND r.to_user_id = u.id) OR (r.from_user_id = u.id AND r.to_user_id = ?))) AS pending "
                        + "FROM `user` u WHERE u.username LIKE ? AND u.username <> ? "
                        + "ORDER BY u.username LIMIT 20",
                meId, meId, meId, "%" + kw + "%", me);
        for (Map<String, Object> row : rows) {
            row.remove("id");
            row.put("factionName", SocialSupport.factionName((String) row.get("faction")));
            row.put("isFriend", SocialSupport.toInt(row.get("isFriend")) > 0);
            row.put("pending", SocialSupport.toInt(row.get("pending")) > 0);
        }
        return rows;
    }

    /** 递结交帖；若对方正好也向自己递了帖，则直接互为同袍 */
    public void addRequest(String me, String target, String message) {
        Long meId = support.requireId(me);
        String to = target == null ? "" : target.trim();
        if (to.isEmpty()) throw new IllegalArgumentException("请填写要结交的名号");
        if (to.equals(me)) throw new IllegalArgumentException("不可与自己结交");
        Long toId = support.userId(to);
        if (toId == null) throw new IllegalArgumentException("帐中查无此将");
        if (support.areFriends(meId, toId)) throw new IllegalArgumentException("已是同袍，无需再递帖");

        Long pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM friend_request WHERE status = 'pending' AND "
                        + "((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))",
                Long.class, meId, toId, toId, meId);
        if (pending != null && pending > 0) {
            throw new IllegalArgumentException("已有待处理的结交帖，请静候回音");
        }

        Long reverse = jdbc.queryForObject(
                "SELECT COUNT(*) FROM friend_request WHERE status = 'pending' "
                        + "AND from_user_id = ? AND to_user_id = ?",
                Long.class, toId, meId);
        if (reverse != null && reverse > 0) {
            jdbc.update("UPDATE friend_request SET status = 'accepted', handle_time = NOW() "
                    + "WHERE status = 'pending' AND from_user_id = ? AND to_user_id = ?", toId, meId);
            befriend(meId, toId);
            return;
        }

        String note = message == null ? "" : message.trim();
        if (note.length() > 120) note = note.substring(0, 120);
        jdbc.update("INSERT INTO friend_request(from_user_id, to_user_id, message, status) "
                + "VALUES(?, ?, ?, 'pending')", meId, toId, note);
    }

    /** 同意 / 拒绝结交帖，只有收帖人可操作 */
    public void handleRequest(String me, Long id, boolean accept) {
        Long meId = support.requireId(me);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM friend_request WHERE id = ? AND status = 'pending'", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("此帖已处理或不存在");
        Map<String, Object> r = rows.get(0);
        if (!meId.equals(SocialSupport.toLong(r.get("to_user_id")))) {
            throw new IllegalArgumentException("只有收帖人可处理此帖");
        }
        Long fromId = SocialSupport.toLong(r.get("from_user_id"));
        if (accept) {
            jdbc.update("UPDATE friend_request SET status = 'accepted', handle_time = NOW() WHERE id = ?", id);
            befriend(meId, fromId);
        } else {
            jdbc.update("UPDATE friend_request SET status = 'rejected', handle_time = NOW() WHERE id = ?", id);
        }
    }

    private void befriend(Long a, Long b) {
        jdbc.update("INSERT IGNORE INTO friendship(user_id, friend_id) VALUES(?, ?), (?, ?)",
                a, b, b, a);
    }

    public void removeFriend(String me, String friendName) {
        Long meId = support.requireId(me);
        Long friendId = support.userId(friendName);
        if (friendId == null || !support.areFriends(meId, friendId)) {
            throw new IllegalArgumentException("同袍名单中查无此人");
        }
        jdbc.update("DELETE FROM friendship WHERE (user_id = ? AND friend_id = ?) "
                + "OR (user_id = ? AND friend_id = ?)", meId, friendId, friendId, meId);
    }

    /** 增量拉取与某位同袍的私信（after 为已拿到的最大消息 id），顺带把对方来信标为已读 */
    public Map<String, Object> messages(String me, String withUser, long after) {
        Long meId = support.requireId(me);
        Long withId = support.userId(withUser);
        if (withId == null) throw new IllegalArgumentException("查无此将");
        if (!support.areFriends(meId, withId)) {
            throw new IllegalArgumentException("须先结为同袍方可通信");
        }

        List<Map<String, Object>> list = jdbc.queryForList(
                "SELECT m.id AS id, uf.username AS fromUsername, m.content AS content, "
                        + "DATE_FORMAT(m.create_time, '%Y-%m-%d %H:%i') AS time, "
                        + "CASE WHEN m.from_user_id = ? THEN 1 ELSE 0 END AS mine "
                        + "FROM friend_message m JOIN `user` uf ON uf.id = m.from_user_id "
                        + "WHERE ((m.from_user_id = ? AND m.to_user_id = ?) "
                        + "   OR (m.from_user_id = ? AND m.to_user_id = ?)) AND m.id > ? "
                        + "ORDER BY m.id ASC LIMIT 200",
                meId, meId, withId, withId, meId, after);

        long lastId = after;
        for (Map<String, Object> m : list) {
            lastId = Math.max(lastId, SocialSupport.toLong(m.get("id")));
            m.put("mine", SocialSupport.toInt(m.get("mine")) == 1);
        }
        jdbc.update("UPDATE friend_message SET is_read = 1 "
                + "WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0", withId, meId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("messages", list);
        data.put("lastId", lastId);
        return data;
    }

    public void sendMessage(String me, String to, String content) {
        Long meId = support.requireId(me);
        Long toId = support.userId(to);
        if (toId == null) throw new IllegalArgumentException("查无此将");
        if (!support.areFriends(meId, toId)) {
            throw new IllegalArgumentException("须先结为同袍方可通信");
        }
        String text = SocialSupport.cleanContent(content, 500);
        jdbc.update("INSERT INTO friend_message(from_user_id, to_user_id, content) VALUES(?, ?, ?)",
                meId, toId, text);
    }
}
