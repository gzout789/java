package com.fenglin.springboottest.config;

import com.fenglin.springboottest.game.GameSocketHandler;
import com.fenglin.springboottest.security.JwtUtil;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** 注册 /ws/game 原生 WebSocket 端点（Vite 开发态由代理转发，生产环境直连后端）。 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameSocketHandler gameSocketHandler;
    private final JwtUtil jwtUtil;

    public WebSocketConfig(GameSocketHandler gameSocketHandler, JwtUtil jwtUtil) {
        this.gameSocketHandler = gameSocketHandler;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gameSocketHandler, "/ws/game")
                .addInterceptors(new GameHandshakeInterceptor(jwtUtil))
                .setAllowedOriginPatterns("*");
    }
}
