package com.fenglin.springboottest.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 联队房间：建队 / 邀同袍 / 凭房号入队 / 整队出征 / 房间频道。
 * 房间最多 5 人，与烽烟三国杀的 5 个席位对应。
 */
@Service
public class TeamService {

    private static final int MAX_MEMBERS = 5;

    private final JdbcTemplate jdbc;
    private final SocialSupport support;

    public TeamService(JdbcTemplate jdbc, SocialSupport support) {
        this.jdbc = jdbc;
        this.support = support;
    }

    /** 一次拿齐「我所在的房间」与「我收到的组队请帖」，前端轮询此接口 */
    public Map<String, Object> overview(String me) {
        Long meId = support.requireId(me);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("room", myRoom(meId));
        data.put("invites", pendingInvites(meId));
        return data;
    }

    private List<Map<String, Object>> pendingInvites(Long meId) {
        return jdbc.queryForList(
                "SELECT i.id AS id, r.code AS roomCode, r.name AS roomName, "
                        + "u.username AS fromUsername, "
                        + "DATE_FORMAT(i.create_time, '%Y-%m-%d %H:%i') AS time "
                        + "FROM team_invite i JOIN team_room r ON r.id = i.room_id "
                        + "JOIN `user` u ON u.id = i.from_user_id "
                        + "WHERE i.to_user_id = ? AND i.status = 'pending' AND r.status = 'waiting' "
                        + "ORDER BY i.id DESC", meId);
    }

    private Map<String, Object> myRoom(Long meId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.id AS id, r.code AS code, r.name AS name, r.status AS status, "
                        + "r.leader_id AS leaderId "
                        + "FROM team_member tm JOIN team_room r ON r.id = tm.room_id "
                        + "WHERE tm.user_id = ? AND r.status <> 'closed' "
                        + "ORDER BY r.id DESC LIMIT 1", meId);
        if (rows.isEmpty()) return null;

        Map<String, Object> r = rows.get(0);
        Long roomId = SocialSupport.toLong(r.get("id"));
        List<Map<String, Object>> members = jdbc.queryForList(
                "SELECT u.username AS username, u.faction AS faction, "
                        + "CASE WHEN u.id = r.leader_id THEN 1 ELSE 0 END AS isLeader, "
                        + "CASE WHEN u.id = ? THEN 1 ELSE 0 END AS isMe "
                        + "FROM team_member tm JOIN `user` u ON u.id = tm.user_id "
                        + "JOIN team_room r ON r.id = tm.room_id "
                        + "WHERE tm.room_id = ? ORDER BY tm.id ASC", meId, roomId);
        for (Map<String, Object> m : members) {
            m.put("factionName", SocialSupport.factionName((String) m.get("faction")));
            m.put("isLeader", SocialSupport.toInt(m.get("isLeader")) == 1);
            m.put("isMe", SocialSupport.toInt(m.get("isMe")) == 1);
        }

        Map<String, Object> room = new LinkedHashMap<>();
        room.put("id", roomId);
        room.put("code", r.get("code"));
        room.put("name", r.get("name"));
        room.put("status", r.get("status"));
        room.put("leaderId", SocialSupport.toLong(r.get("leaderId")));
        room.put("members", members);
        return room;
    }

    public Map<String, Object> create(String me, String name) {
        Long meId = support.requireId(me);
        leaveInternal(meId);

        String roomName = name == null ? "" : name.trim();
        if (roomName.isEmpty()) roomName = "同袍联队";
        if (roomName.length() > 40) roomName = roomName.substring(0, 40);

        String code = newCode();
        jdbc.update("INSERT INTO team_room(code, name, leader_id, status) VALUES(?, ?, ?, 'waiting')",
                code, roomName, meId);
        Long roomId = jdbc.queryForObject("SELECT id FROM team_room WHERE code = ?", Long.class, code);
        jdbc.update("INSERT INTO team_member(room_id, user_id) VALUES(?, ?)", roomId, meId);
        systemMessage(roomId, me + " 建起联队，静候同袍入列。");
        return myRoom(meId);
    }

    private String newCode() {
        for (int i = 0; i < 8; i++) {
            String code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
            Long exists = jdbc.queryForObject("SELECT COUNT(*) FROM team_room WHERE code = ?", Long.class, code);
            if (exists == null || exists == 0) return code;
        }
        throw new IllegalArgumentException("房号生成失败，请稍后重试");
    }

    public void invite(String me, String username) {
        Long meId = support.requireId(me);
        Map<String, Object> room = myRoom(meId);
        if (room == null) throw new IllegalArgumentException("请先创建或加入联队");
        if ("playing".equals(room.get("status"))) throw new IllegalArgumentException("联队已出征，不可再邀人");

        Long roomId = SocialSupport.toLong(room.get("id"));
        String to = username == null ? "" : username.trim();
        Long toId = support.userId(to);
        if (toId == null) throw new IllegalArgumentException("查无此将");
        if (toId.equals(meId)) throw new IllegalArgumentException("不可邀自己入队");
        if (!support.areFriends(meId, toId)) throw new IllegalArgumentException("须先结为同袍方可邀其入队");

        Long already = jdbc.queryForObject(
                "SELECT COUNT(*) FROM team_member WHERE room_id = ? AND user_id = ?",
                Long.class, roomId, toId);
        if (already != null && already > 0) throw new IllegalArgumentException("此将已在队中");

        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM team_member WHERE room_id = ?",
                Long.class, roomId);
        if (count != null && count >= MAX_MEMBERS) throw new IllegalArgumentException("联队已满五员");

        Long pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM team_invite WHERE room_id = ? AND to_user_id = ? AND status = 'pending'",
                Long.class, roomId, toId);
        if (pending != null && pending > 0) throw new IllegalArgumentException("请帖已递，静候回音");

        jdbc.update("INSERT INTO team_invite(room_id, from_user_id, to_user_id, status) "
                + "VALUES(?, ?, ?, 'pending')", roomId, meId, toId);
        systemMessage(roomId, me + " 邀 " + to + " 入列，静候回音。");
    }

    public void handleInvite(String me, Long id, boolean accept) {
        Long meId = support.requireId(me);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM team_invite WHERE id = ? AND status = 'pending'", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("此请帖已处理或不存在");
        Map<String, Object> inv = rows.get(0);
        if (!meId.equals(SocialSupport.toLong(inv.get("to_user_id")))) {
            throw new IllegalArgumentException("只有受邀人可处理此帖");
        }
        if (!accept) {
            jdbc.update("UPDATE team_invite SET status = 'rejected' WHERE id = ?", id);
            return;
        }
        Long roomId = SocialSupport.toLong(inv.get("room_id"));
        List<Map<String, Object>> rooms = jdbc.queryForList(
                "SELECT status FROM team_room WHERE id = ?", roomId);
        if (rooms.isEmpty() || !"waiting".equals(rooms.get(0).get("status"))) {
            throw new IllegalArgumentException("此联队已出征或解散");
        }
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM team_member WHERE room_id = ?",
                Long.class, roomId);
        if (count != null && count >= MAX_MEMBERS) throw new IllegalArgumentException("联队已满五员");

        jdbc.update("UPDATE team_invite SET status = 'accepted' WHERE id = ?", id);
        joinInternal(meId, roomId);
    }

    public Map<String, Object> join(String me, String code) {
        Long meId = support.requireId(me);
        String c = code == null ? "" : code.trim().toUpperCase();
        List<Map<String, Object>> rooms = jdbc.queryForList(
                "SELECT id, status FROM team_room WHERE code = ?", c);
        if (rooms.isEmpty()) throw new IllegalArgumentException("房号有误，查无此联队");
        if (!"waiting".equals(rooms.get(0).get("status"))) {
            throw new IllegalArgumentException("此联队已出征或解散");
        }
        Long roomId = SocialSupport.toLong(rooms.get(0).get("id"));
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM team_member WHERE room_id = ?",
                Long.class, roomId);
        if (count != null && count >= MAX_MEMBERS) throw new IllegalArgumentException("联队已满五员");
        joinInternal(meId, roomId);
        return myRoom(meId);
    }

    private void joinInternal(Long meId, Long roomId) {
        leaveInternal(meId);
        jdbc.update("INSERT IGNORE INTO team_member(room_id, user_id) VALUES(?, ?)", roomId, meId);
        systemMessage(roomId, support.username(meId) + " 入列。");
    }

    public void leave(String me) {
        leaveInternal(support.requireId(me));
    }

    /** 退出所有未解散房间；房主离开则顺位转让，空队自动解散 */
    private void leaveInternal(Long meId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT tm.room_id AS roomId, r.leader_id AS leaderId "
                        + "FROM team_member tm JOIN team_room r ON r.id = tm.room_id "
                        + "WHERE tm.user_id = ? AND r.status <> 'closed'", meId);
        for (Map<String, Object> row : rows) {
            Long roomId = SocialSupport.toLong(row.get("roomId"));
            jdbc.update("DELETE FROM team_member WHERE room_id = ? AND user_id = ?", roomId, meId);
            Long remain = jdbc.queryForObject("SELECT COUNT(*) FROM team_member WHERE room_id = ?",
                    Long.class, roomId);
            if (remain == null || remain == 0) {
                jdbc.update("UPDATE team_room SET status = 'closed' WHERE id = ?", roomId);
            } else if (meId.equals(SocialSupport.toLong(row.get("leaderId")))) {
                jdbc.update("UPDATE team_room SET leader_id = "
                        + "(SELECT user_id FROM team_member WHERE room_id = ? ORDER BY id ASC LIMIT 1) "
                        + "WHERE id = ?", roomId, roomId);
                systemMessage(roomId, support.username(meId) + " 离队，房主之位顺位相让。");
            } else {
                systemMessage(roomId, support.username(meId) + " 离队。");
            }
        }
    }

    /** 房主擂鼓：房间转入 playing，队员轮询到状态后一起跳进烽烟三国杀 */
    public void start(String me) {
        Long meId = support.requireId(me);
        Map<String, Object> room = myRoom(meId);
        if (room == null) throw new IllegalArgumentException("请先创建或加入联队");
        if (!meId.equals(SocialSupport.toLong(room.get("leaderId")))) {
            throw new IllegalArgumentException("只有房主可整队出征");
        }
        Long roomId = SocialSupport.toLong(room.get("id"));
        jdbc.update("UPDATE team_room SET status = 'playing', start_time = NOW() WHERE id = ?", roomId);
        systemMessage(roomId, "房主 " + me + " 擂鼓整队，众同袍共赴烽烟三国杀！");
    }

    /** 房间频道增量消息（含军令与战报） */
    public Map<String, Object> messages(String me, long after) {
        Long meId = support.requireId(me);
        Map<String, Object> room = myRoom(meId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("room", room);
        if (room == null) {
            data.put("messages", Collections.emptyList());
            data.put("lastId", after);
            return data;
        }
        Long roomId = SocialSupport.toLong(room.get("id"));
        List<Map<String, Object>> list = jdbc.queryForList(
                "SELECT id, IFNULL(username, '军令') AS username, content, type, "
                        + "DATE_FORMAT(create_time, '%Y-%m-%d %H:%i') AS time "
                        + "FROM team_message WHERE room_id = ? AND id > ? "
                        + "ORDER BY id ASC LIMIT 200", roomId, after);
        long lastId = after;
        for (Map<String, Object> m : list) {
            lastId = Math.max(lastId, SocialSupport.toLong(m.get("id")));
        }
        data.put("messages", list);
        data.put("lastId", lastId);
        return data;
    }

    public void postMessage(String me, String content) {
        Long meId = support.requireId(me);
        Map<String, Object> room = myRoom(meId);
        if (room == null) throw new IllegalArgumentException("尚未加入联队");
        String text = SocialSupport.cleanContent(content, 500);
        jdbc.update("INSERT INTO team_message(room_id, user_id, username, content, type) "
                + "VALUES(?, ?, ?, ?, 'chat')", SocialSupport.toLong(room.get("id")), meId, me, text);
    }

    /** 由游戏侧上报战报到房间频道（type=report），同袍都能看到 */
    public void postReport(String me, String content) {
        Long meId = support.requireId(me);
        Map<String, Object> room = myRoom(meId);
        if (room == null) return;
        String text = content == null ? "" : content.trim();
        if (text.isEmpty()) return;
        if (text.length() > 500) text = text.substring(0, 500);
        jdbc.update("INSERT INTO team_message(room_id, user_id, username, content, type) "
                + "VALUES(?, ?, ?, ?, 'report')", SocialSupport.toLong(room.get("id")), meId, me, text);
    }

    private void systemMessage(Long roomId, String text) {
        jdbc.update("INSERT INTO team_message(room_id, username, content, type) "
                + "VALUES(?, '军令', ?, 'system')", roomId, text);
    }
}
