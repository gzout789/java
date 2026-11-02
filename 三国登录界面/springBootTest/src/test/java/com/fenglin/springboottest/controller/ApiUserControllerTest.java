package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.dto.LoginRequest;
import com.fenglin.springboottest.dto.LoginUserVO;
import com.fenglin.springboottest.dto.RegisterRequest;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.security.JwtUtil;
import com.fenglin.springboottest.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * 登录 / 注册接口单元测试：校验、重复账号、密码加密、空参数。
 */
class ApiUserControllerTest {

    private ApiUserController controller;
    private UserService userService;
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtil = mock(JwtUtil.class);
        controller = new ApiUserController(userService, passwordEncoder, jwtUtil);
    }

    private User user(String name, String faction, String encodedPwd) {
        User u = new User();
        u.setUsername(name);
        u.setFaction(faction);
        u.setPassword(encodedPwd);
        return u;
    }

    @Test
    void login_success_returnsToken() {
        when(userService.findByUsername("云长"))
                .thenReturn(user("云长", "shu", "$2a$10$hashed"));
        when(passwordEncoder.matches("danfeng123", "$2a$10$hashed")).thenReturn(true);
        when(jwtUtil.create("云长")).thenReturn("token-abc");

        ApiResult<LoginUserVO> result = controller.login(req("云长", "danfeng123"));

        assertTrue(result.isSuccess());
        assertEquals("云长", result.getData().getUsername());
        assertEquals("shu", result.getData().getFaction());
        assertEquals("token-abc", result.getData().getToken());
    }

    @Test
    void login_wrongPassword_fails() {
        when(userService.findByUsername("云长"))
                .thenReturn(user("云长", "shu", "$2a$10$hashed"));
        when(passwordEncoder.matches("wrong", "$2a$10$hashed")).thenReturn(false);

        ApiResult<LoginUserVO> result = controller.login(req("云长", "wrong"));

        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("有误"));
        assertNull(result.getData());
    }

    @Test
    void login_unknownUser_fails() {
        when(userService.findByUsername("不存在")).thenReturn(null);
        ApiResult<LoginUserVO> result = controller.login(req("不存在", "whatever"));
        assertFalse(result.isSuccess());
    }

    @Test
    void login_emptyParams_fails() {
        ApiResult<LoginUserVO> result = controller.login(req("", ""));
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("不可为空"));
    }

    @Test
    void register_duplicateUsername_fails() {
        when(userService.findByUsername("云长"))
                .thenReturn(user("云长", "shu", "x"));

        ApiResult<Void> result = controller.register(reg("云长", "danfeng123", "shu"));

        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("已有人使用"));
        verify(userService, never()).save(any());
    }

    @Test
    void register_success_encodesPasswordAndSaves() {
        when(userService.findByUsername("新将")).thenReturn(null);
        when(passwordEncoder.encode("danfeng123")).thenReturn("$2a$10$encoded");
        when(userService.save(any())).thenReturn(true);

        ApiResult<Void> result = controller.register(reg("新将", "danfeng123", "shu"));

        assertTrue(result.isSuccess());
        // 密码必须被 BCrypt 加密，而不是明文入库
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userService).save(captor.capture());
        assertEquals("$2a$10$encoded", captor.getValue().getPassword());
        assertEquals("shu", captor.getValue().getFaction());
    }

    @Test
    void register_passwordTooShort_fails() {
        ApiResult<Void> result = controller.register(reg("新将", "123", "shu"));
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("至少六位"));
    }

    @Test
    void register_invalidFaction_fails() {
        when(userService.findByUsername("新将")).thenReturn(null);
        ApiResult<Void> result = controller.register(reg("新将", "danfeng123", "邪恶势力"));
        assertFalse(result.isSuccess());
        assertTrue(result.getMessage().contains("阵营"));
    }

    private LoginRequest req(String name, String pwd) {
        LoginRequest r = new LoginRequest();
        r.setUsername(name);
        r.setPassword(pwd);
        return r;
    }

    private RegisterRequest reg(String name, String pwd, String faction) {
        RegisterRequest r = new RegisterRequest();
        r.setUsername(name);
        r.setPassword(pwd);
        r.setFaction(faction);
        return r;
    }
}
