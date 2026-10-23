package com.fenglin.springboottest.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 签发与校验（jjwt 0.12.x）
 * 同一条密钥签两类令牌：
 * - 将军令牌：只有 subject，用于前台 /api/**
 * - 管理令牌：额外带 role=admin 声明，用于后台 /api/admin/**
 * 前台拦截器不校验 role，后台拦截器必须校验 role，两类令牌互不通用。
 */
@Component
public class JwtUtil {

    @Value("${sanguo.jwt.secret}")
    private String secret;

    @Value("${sanguo.jwt.expire-hours:12}")
    private long expireHours;

    @Value("${sanguo.jwt.admin-role:admin}")
    private String adminRole;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** 签发将军令牌 */
    public String create(String username) {
        return build(username, null);
    }

    /** 签发管理令牌 */
    public String createAdmin(String username) {
        return build(username, adminRole);
    }

    private String build(String username, String role) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expireHours * 3600_000L);
        JwtBuilder builder = Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(exp);
        if (role != null) {
            builder.claim("role", role);
        }
        return builder.signWith(key()).compact();
    }

    /** 解析完整声明，非法或过期返回 null */
    public Claims parse(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        try {
            return Jwts.parser()
                    .verifyWith(key())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    /** 校验并取出用户名，非法或过期返回 null */
    public String parseUsername(String token) {
        Claims claims = parse(token);
        return claims == null ? null : claims.getSubject();
    }

    /**
     * 只接受将军令牌：带 role 声明的管理令牌不能当将军令牌用。
     * 两类令牌各走各的入口，任何一边都拿不到另一边的接口。
     */
    public String parseUserToken(String token) {
        Claims claims = parse(token);
        if (claims == null || claims.get("role", String.class) != null) {
            return null;
        }
        return claims.getSubject();
    }

    /** 取出角色声明，非管理员令牌返回 null */
    public String parseAdminRole(String token) {
        Claims claims = parse(token);
        if (claims == null) {
            return null;
        }
        String role = claims.get("role", String.class);
        return adminRole.equals(role) ? role : null;
    }
}
