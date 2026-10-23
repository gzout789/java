package com.fenglin.springboottest.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fenglin.springboottest.common.ApiResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 后台管理接口守卫：/api/admin/** 除登录外都要求管理令牌（role=admin）。
 * 前台将军令牌没有 role 声明，进不了后台；后台令牌同样拿不到前台数据以外的权限。
 */
@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final JwtUtil jwtUtil;

    public AdminAuthInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String header = request.getHeader("Authorization");
        String token = null;
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = header.substring(7).trim();
        }

        String role = token == null || token.isEmpty() ? null : jwtUtil.parseAdminRole(token);
        if (role == null) {
            writeUnauthorized(response);
            return false;
        }

        request.setAttribute("adminUser", jwtUtil.parseUsername(token));
        return true;
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(MAPPER.writeValueAsString(ApiResult.fail("管理凭信已失效，请重新登录后台")));
    }
}
