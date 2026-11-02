package com.fenglin.springboottest.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录限流器（内存版，单机部署够用；多实例请换 Redis）。
 *
 * 按「来源 IP」和「账号名」两个维度做固定时间窗计数，防止暴力破解：
 * - 同一 IP 在窗口内尝试次数超过上限即拒绝
 * - 同一账号在窗口内失败次数超过上限即拒绝（无论从哪个 IP 来）
 *
 * 线程安全：ConcurrentHashMap + 每键 Deque 用 synchronized 保护。
 */
@Component
public class LoginRateLimiter {

    /** 统计窗口（毫秒） */
    private static final long WINDOW_MS = 15 * 60 * 1000L;

    /** 单 IP 窗口内最大尝试次数 */
    private static final int IP_MAX_ATTEMPTS = 30;

    /** 单账号窗口内最大失败次数 */
    private static final int ACCOUNT_MAX_FAILURES = 10;

    private final Map<String, Deque<Long>> ipAttempts = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> accountFailures = new ConcurrentHashMap<>();

    /** 记录一次登录尝试，若 IP 超限返回 true */
    public boolean recordIpAttempt(String ip) {
        return exceed(ipAttempts, key(ip), IP_MAX_ATTEMPTS);
    }

    /** 记录一次账号登录失败，若账号失败超限返回 true */
    public boolean recordAccountFailure(String username) {
        return exceed(accountFailures, key(username), ACCOUNT_MAX_FAILURES);
    }

    /** 登录成功时清除该账号的失败计数 */
    public void clearAccount(String username) {
        accountFailures.remove(key(username));
    }

    private boolean exceed(Map<String, Deque<Long>> store, String key, int max) {
        Deque<Long> deque = store.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            long now = Instant.now().toEpochMilli();
            long cutoff = now - WINDOW_MS;
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) {
                deque.pollFirst();
            }
            deque.addLast(now);
            return deque.size() > max;
        }
    }

    private String key(String raw) {
        return raw == null ? "" : raw.trim();
    }
}
