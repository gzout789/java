package com.fenglin.springboottest.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 联机牌局总线。
 *
 * 设计取舍：三国杀的规则链（技能、判定、濒死响应、AI）是几千行前端状态机，
 * 整体移植到服务端既重复又易走样。因此采用「房主权威 + 服务端权威分发」：
 *   - 服务端是唯一可信的房间 / 席位 / 消息路由，负责按席位分发脱敏快照；
 *   - 房主浏览器运行唯一的规则引擎，队员端只是规则计算器 + 动作代理；
 *   - 队员的每次操作都经服务端转发给房主结算，结算结果再由服务端广播。
 * 玩家可见效果：同一副牌、同一回合、轮到谁谁操作、动作实时同步。
 *
 * 消息协议（客户端 → 服务端）
 *   {t:'state', views:{"0":{...},"1":{...}}}  仅房主：按席位脱敏后的状态快照
 *   {t:'picks', candidates:[...]}             仅房主：本局选将候选，广播给队员
 *   {t:'reset'}                               仅房主：再战一局，清掉旧局状态
 *   {t:'action', kind, ...}                   队员：一次游戏动作，转发房主
 *   {t:'pick', heroId}                        队员：选将，转发房主
 *   {t:'ping'}                                心跳
 *
 * 消息协议（服务端 → 客户端）
 *   {t:'hello', code, seatIdx, isHost, humanSeats, seatNames, members}
 *   {t:'state', view, rev} / {t:'picks', candidates} / {t:'reset'}
 *   {t:'action', ..., fromSeat} / {t:'pick', heroId, fromSeat}
 *   {t:'member', kind, username, seatIdx} / {t:'host-lost'} / {t:'pong'}
 */
@Component
public class GameSocketHandler extends TextWebSocketHandler {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    /** 房号 → 房间（内存态，牌局生命周期内有效） */
    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
    /** sessionId → 绑定关系 */
    private final ConcurrentHashMap<String, Binding> bindings = new ConcurrentHashMap<>();

    public GameSocketHandler(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final class Binding {
        String code;
        String user;
        int seat;
        boolean host;
    }

    private static final class Room {
        final String code;
        final String hostUser;
        /** 席位 → 名号，建房间时固定，掉线也不重排 */
        final Map<Integer, String> names = new LinkedHashMap<>();
        final Map<Integer, WebSocketSession> online = new ConcurrentHashMap<>();
        volatile Map<String, Object> views;
        volatile int rev = 0;

        Room(String code, String hostUser) {
            this.code = code;
            this.hostUser = hostUser;
        }

        WebSocketSession hostSession() {
            for (Map.Entry<Integer, WebSocketSession> e : online.entrySet()) {
                if (hostUser.equals(names.get(e.getKey()))) return e.getValue();
            }
            return null;
        }
    }

    /* ==================== 连接建立 ==================== */

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Map<String, Object> attr = session.getAttributes();
        String user = (String) attr.get("gameUser");
        String askedCode = (String) attr.get("gameCode");

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.id AS roomId, r.code AS code, lu.username AS leaderName "
                        + "FROM team_member tm JOIN team_room r ON r.id = tm.room_id "
                        + "JOIN `user` me ON me.id = tm.user_id "
                        + "JOIN `user` lu ON lu.id = r.leader_id "
                        + "WHERE me.username = ? AND r.status = 'playing' "
                        + "ORDER BY r.id DESC LIMIT 1", user);
        if (rows.isEmpty()) {
            send(session, error("尚未整队出征，请先在中军大帐组建联队"));
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("no playing room"));
            return;
        }
        String code = String.valueOf(rows.get(0).get("code")).toUpperCase();
        if (!askedCode.isEmpty() && !askedCode.equals(code)) {
            send(session, error("房号与当前联队不符"));
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("code mismatch"));
            return;
        }
        String leader = String.valueOf(rows.get(0).get("leaderName"));
        long roomId = ((Number) rows.get(0).get("roomId")).longValue();

        Room room = rooms.compute(code, (k, old) -> {
            if (old != null && old.hostUser.equals(leader)) return old;
            return buildRoom(k, leader, roomId);
        });
        Integer seat = seatOf(room, user);
        if (seat == null) {
            send(session, error("你不在此联队名册中"));
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("not a member"));
            return;
        }

        /* 同一账号重复连接：先挤掉旧连接，避免两个席位同时收到快照 */
        WebSocketSession previous = room.online.put(seat, session);
        if (previous != null && previous.isOpen()) {
            try { previous.close(CloseStatus.NORMAL.withReason("replaced by newer session")); }
            catch (IOException ignored) { /* 旧连接已断 */ }
        }

        Binding b = new Binding();
        b.code = code;
        b.user = user;
        b.seat = seat;
        b.host = user.equals(leader);
        bindings.put(session.getId(), b);

        ObjectNode hello = mapper.createObjectNode();
        hello.put("t", "hello");
        hello.put("code", code);
        hello.put("seatIdx", seat);
        hello.put("isHost", b.host);
        hello.set("humanSeats", mapper.valueToTree(new ArrayList<>(room.names.keySet())));
        hello.set("seatNames", mapper.valueToTree(room.names));
        hello.set("members", mapper.valueToTree(memberList(room)));
        send(session, hello);

        /* 断线重连：立刻补发最近一份快照，不用等房主下一次状态变更 */
        Map<String, Object> views = room.views;
        if (views != null) {
            Object view = views.get(String.valueOf(seat));
            if (view != null) send(session, frame("state").put("rev", room.rev).set("view", mapper.valueToTree(view)));
        }
        broadcast(room, frame("member").put("kind", "join").put("username", user).put("seatIdx", seat), seat);
    }

    private Room buildRoom(String code, String leader, long roomId) {
        Room room = new Room(code, leader);
        List<Map<String, Object>> members = jdbc.queryForList(
                "SELECT u.username AS username FROM team_member tm "
                        + "JOIN `user` u ON u.id = tm.user_id "
                        + "WHERE tm.room_id = ? ORDER BY tm.id ASC", roomId);
        /* 房主固定坐 0 号席（引擎的主循环从这里起手），其余按入列顺序 */
        int idx = 0;
        room.names.put(0, leader);
        for (Map<String, Object> m : members) {
            String name = String.valueOf(m.get("username"));
            if (name.equals(leader)) continue;
            room.names.put(++idx, name);
            if (idx >= 4) break; // 5 人局，真人最多 5 席
        }
        return room;
    }

    private static Integer seatOf(Room room, String user) {
        for (Map.Entry<Integer, String> e : room.names.entrySet()) {
            if (e.getValue().equals(user)) return e.getKey();
        }
        return null;
    }

    private List<Map<String, Object>> memberList(Room room) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<Integer, String> e : room.names.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("seatIdx", e.getKey());
            m.put("username", e.getValue());
            m.put("online", room.online.containsKey(e.getKey()));
            m.put("isHost", e.getValue().equals(room.hostUser));
            list.add(m);
        }
        return list;
    }

    /* ==================== 消息路由 ==================== */

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Binding b = bindings.get(session.getId());
        if (b == null) return;
        Room room = rooms.get(b.code);
        if (room == null) return;

        JsonNode node;
        try {
            node = mapper.readTree(message.getPayload());
        } catch (Exception e) {
            return;
        }
        String t = node.path("t").asText("");

        switch (t) {
            case "ping" -> send(session, frame("pong"));
            case "state" -> {
                if (!b.host) return;
                JsonNode viewsNode = node.get("views");
                if (viewsNode == null || !viewsNode.isObject()) return;
                Map<String, Object> views = mapper.convertValue(viewsNode, Map.class);
                room.views = views;
                room.rev++;
                for (Map.Entry<Integer, WebSocketSession> e : room.online.entrySet()) {
                    Object view = views.get(String.valueOf(e.getKey()));
                    if (view == null) continue;
                    send(e.getValue(), frame("state")
                            .put("rev", room.rev)
                            .set("view", mapper.valueToTree(view)));
                }
            }
            case "picks" -> {
                if (!b.host) return;
                broadcast(room, frame("picks").set("candidates", node.get("candidates")), b.seat);
            }
            case "reset" -> {
                if (!b.host) return;
                room.views = null;
                room.rev++;
                broadcast(room, frame("reset").put("rev", room.rev), b.seat);
            }
            case "action", "pick" -> {
                if (b.host) return; // 房主动作在本地引擎直接结算，不必绕服务端一圈
                WebSocketSession host = room.hostSession();
                if (host == null) {
                    send(session, error("房主已离阵，本局无法继续推进"));
                    return;
                }
                ObjectNode forward = mapper.createObjectNode();
                node.fields().forEachRemaining(en -> forward.set(en.getKey(), en.getValue()));
                forward.put("fromSeat", b.seat);
                forward.put("fromUser", b.user);
                /* 动作作用席位一律以服务端分配为准：队员不能改 idx 去动别人的牌 */
                if ("action".equals(t)) forward.put("idx", b.seat);
                send(host, forward);
            }
            default -> { /* 未知消息忽略 */ }
        }
    }

    /* ==================== 断连清理 ==================== */

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Binding b = bindings.remove(session.getId());
        if (b == null) return;
        Room room = rooms.get(b.code);
        if (room == null) return;
        /* 只有当前仍是该席位的连接才移除，避免旧连接关闭误踢掉新连接 */
        room.online.remove(b.seat, session);
        broadcast(room, frame("member").put("kind", "leave").put("username", b.user).put("seatIdx", b.seat), null);
        if (b.host) {
            broadcast(room, frame("host-lost").put("username", b.user), null);
        }
        if (room.online.isEmpty()) rooms.remove(b.code, room);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        // 传输异常随后会触发 afterConnectionClosed，这里不重复清理
    }

    /* ==================== 工具 ==================== */

    private ObjectNode frame(String t) {
        return mapper.createObjectNode().put("t", t);
    }

    private ObjectNode error(String message) {
        return frame("error").put("message", message);
    }

    private void broadcast(Room room, ObjectNode payload, Integer exceptSeat) {
        for (Map.Entry<Integer, WebSocketSession> e : room.online.entrySet()) {
            if (exceptSeat != null && exceptSeat.equals(e.getKey())) continue;
            send(e.getValue(), payload);
        }
    }

    private void send(WebSocketSession session, Object payload) {
        if (session == null || !session.isOpen()) return;
        try {
            String json = payload instanceof ObjectNode ? payload.toString() : mapper.writeValueAsString(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException ignored) {
            // 对端已断开，等 afterConnectionClosed 清理
        }
    }
}
