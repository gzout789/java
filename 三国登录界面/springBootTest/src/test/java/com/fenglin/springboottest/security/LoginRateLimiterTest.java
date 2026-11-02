package com.fenglin.springboottest.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 登录限流器单元测试：IP 维度、账号维度、成功清零。
 */
class LoginRateLimiterTest {

    @Test
    void ipAttempts_withinLimit_returnsFalse() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        // IP 上限 30，前 30 次都不超
        for (int i = 0; i < 30; i++) {
            assertFalse(limiter.recordIpAttempt("192.168.1.1"));
        }
    }

    @Test
    void ipAttempts_exceedsLimit_returnsTrue() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int i = 0; i < 30; i++) {
            limiter.recordIpAttempt("192.168.1.2");
        }
        // 第 31 次超限
        assertTrue(limiter.recordIpAttempt("192.168.1.2"));
    }

    @Test
    void accountFailures_exceedsLimit_returnsTrue() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int i = 0; i < 10; i++) {
            assertFalse(limiter.recordAccountFailure("云长"));
        }
        // 第 11 次失败超限
        assertTrue(limiter.recordAccountFailure("云长"));
    }

    @Test
    void clearAccount_resetsFailureCount() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int i = 0; i < 10; i++) {
            limiter.recordAccountFailure("云长");
        }
        assertTrue(limiter.recordAccountFailure("云长")); // 已锁定

        limiter.clearAccount("云长");
        // 清零后重新计数，前 10 次又不超
        for (int i = 0; i < 10; i++) {
            assertFalse(limiter.recordAccountFailure("云长"));
        }
    }

    @Test
    void differentIps_areIndependent() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        for (int i = 0; i < 30; i++) {
            limiter.recordIpAttempt("10.0.0.1");
        }
        // 另一个 IP 不受影响
        assertFalse(limiter.recordIpAttempt("10.0.0.2"));
    }
}
