package com.fenglin.springboottest.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fenglin.springboottest.common.ApiResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 登录接口限流：拦截 /api/login 与 /api/admin/login，
 * 按来源 IP 做固定窗口计数，超限返回 429。
 * 「账号失败」维度的计数由各登录 Controller 在判定失败后调用 limiter 记录。
 */
@Component
public class LoginRateLimitInterceptor implements HandlerInterceptor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final LoginRateLimiter limiter;

    public LoginRateLimitInterceptor(LoginRateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String ip = clientIp(request);
        if (limiter.recordIpAttempt(ip)) {
            response.setStatus(429);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(MAPPER.writeValueAsString(
                    ApiResult.fail("尝试过于频繁，请稍后再试")));
            return false;
        }
        return true;
    }

    private String clientIp(HttpServletRequest request) {
        // 若有反向代理，优先取 X-Forwarded-For 的首个地址
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            int comma = xff.indexOf(',');
            return comma > 0 ? xff.substring(0, comma).trim() : xff.trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
