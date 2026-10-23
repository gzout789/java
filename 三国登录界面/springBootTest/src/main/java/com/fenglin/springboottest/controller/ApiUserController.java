package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.dto.LoginRequest;
import com.fenglin.springboottest.dto.LoginUserVO;
import com.fenglin.springboottest.dto.RegisterRequest;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.security.JwtUtil;
import com.fenglin.springboottest.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 前端对接的账号接口：/api/login、/api/register、/api/stats
 */
@RestController
@RequestMapping("/api")
public class ApiUserController {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final Map<String, String> FACTION_NAMES = Map.of(
            "han", "汉室",
            "wei", "曹魏",
            "shu", "蜀汉",
            "wu", "东吴"
    );

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public ApiUserController(UserService userService, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public ApiResult<LoginUserVO> login(@RequestBody LoginRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();

        if (username.isEmpty() || password.isEmpty()) {
            return ApiResult.fail("名号与密令皆不可为空");
        }

        User user = userService.findByUsername(username);
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            return ApiResult.fail("名号或虎符密令有误，请重新核对");
        }

        LoginUserVO vo = new LoginUserVO();
        vo.setUsername(user.getUsername());
        vo.setFaction(user.getFaction());
        vo.setFactionName(FACTION_NAMES.getOrDefault(user.getFaction(), "汉室"));
        vo.setCreateTime(user.getCreateTime() == null ? "" : user.getCreateTime().format(TIME_FMT));
        vo.setToken(jwtUtil.create(user.getUsername()));
        return ApiResult.ok("点兵入帐成功", vo);
    }

    @PostMapping("/register")
    public ApiResult<Void> register(@RequestBody RegisterRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();
        String faction = req.getFaction() == null ? "han" : req.getFaction().trim();

        if (username.length() < 2 || username.length() > 20) {
            return ApiResult.fail("名号需二至二十字");
        }
        if (password.length() < 6) {
            return ApiResult.fail("虎符密令至少六位");
        }
        if (!FACTION_NAMES.containsKey(faction)) {
            return ApiResult.fail("阵营不明，请重新择旗");
        }
        if (userService.findByUsername(username) != null) {
            return ApiResult.fail("此名号已有人使用，请另择一号");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setFaction(faction);
        user.setCreateTime(LocalDateTime.now());
        user.setUpdateTime(LocalDateTime.now());
        userService.save(user);

        return ApiResult.ok("入册成功，可点兵入帐", null);
    }

    @org.springframework.web.bind.annotation.GetMapping("/stats")
    public ApiResult<Map<String, Object>> stats() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", userService.count());
        data.put("byFaction", userService.countByFaction());
        return ApiResult.ok(data);
    }
}
