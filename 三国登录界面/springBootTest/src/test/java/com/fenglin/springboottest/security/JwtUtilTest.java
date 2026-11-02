package com.fenglin.springboottest.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JwtUtil 单元测试：签名 / 校验 / 过期 / 篡改 / 两类令牌隔离。
 * 不依赖 Spring 容器，用反射注入配置项，纯内存测试。
 */
class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        // 用反射注入 @Value 字段，避免启动整个 Spring 上下文
        ReflectionTestUtils.setField(jwtUtil, "secret",
                "sanguo-login-jwt-secret-key-2026-fenglin-test-key-32chars!");
        ReflectionTestUtils.setField(jwtUtil, "expireHours", 12L);
        ReflectionTestUtils.setField(jwtUtil, "adminRole", "admin");
    }

    @Test
    void createThenParse_returnsUsername() {
        String token = jwtUtil.create("云长");
        assertEquals("云长", jwtUtil.parseUsername(token));
    }

    @Test
    void createAdminThenParseAdminRole_returnsRole() {
        String token = jwtUtil.createAdmin("admin");
        assertEquals("admin", jwtUtil.parseAdminRole(token));
    }

    @Test
    void parseUserToken_rejectsAdminToken() {
        // 管理令牌带 role 声明，不能当将军令牌用
        String adminToken = jwtUtil.createAdmin("admin");
        assertNull(jwtUtil.parseUserToken(adminToken));
    }

    @Test
    void parseAdminRole_rejectsUserToken() {
        // 将军令牌无 role 声明，不能当管理令牌用
        String userToken = jwtUtil.create("云长");
        assertNull(jwtUtil.parseAdminRole(userToken));
    }

    @Test
    void parse_tamperedToken_returnsNull() {
        String token = jwtUtil.create("云长");
        // 篡改最后一个字符
        String tampered = token.substring(0, token.length() - 1)
                + (token.endsWith("a") ? "b" : "a");
        assertNull(jwtUtil.parse(tampered));
    }

    @Test
    void parse_nullOrEmpty_returnsNull() {
        assertNull(jwtUtil.parse(null));
        assertNull(jwtUtil.parse(""));
        assertNull(jwtUtil.parseUsername(null));
    }

    @Test
    void create_tokenContainsSubject() {
        String token = jwtUtil.create("云长");
        Claims claims = jwtUtil.parse(token);
        assertNotNull(claims);
        assertEquals("云长", claims.getSubject());
        // 未过期
        assertTrue(claims.getExpiration().getTime() > System.currentTimeMillis());
    }

    @Test
    void expiredToken_returnsNull() {
        // 直接把过期时间设成负数，签一个已过期的令牌
        ReflectionTestUtils.setField(jwtUtil, "expireHours", -1L);
        String token = jwtUtil.create("云长");
        assertNull(jwtUtil.parse(token));
    }
}
