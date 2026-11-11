package com.fenglin.springboottest.config;

import com.fenglin.springboottest.security.JwtUtil;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * 联机牌局握手鉴权。
 *
 * WebSocket 握手不经过 Spring MVC 的 /api/** 拦截器，所以这里单独校验将军令牌。
 * 令牌通过 URL query 传递（浏览器原生 WebSocket 不支持自定义请求头）。
 */
public class GameHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    public GameHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servlet)) return false;
        String token = servlet.getServletRequest().getParameter("token");
        String username = jwtUtil.parseUserToken(token);
        if (username == null) return false;

        String code = servlet.getServletRequest().getParameter("code");
        attributes.put("gameUser", username);
        attributes.put("gameCode", code == null ? "" : code.trim().toUpperCase());
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 无需处理
    }
}
