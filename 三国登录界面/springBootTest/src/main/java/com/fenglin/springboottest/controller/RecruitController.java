package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.dto.RecruitRequest;
import com.fenglin.springboottest.service.RecruitService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 点将台：招募武将（需登录，AuthInterceptor 已注入 currentUser）
 */
@RestController
@RequestMapping("/api")
public class RecruitController {

    private final RecruitService recruitService;

    public RecruitController(RecruitService recruitService) {
        this.recruitService = recruitService;
    }

    @GetMapping("/recruit")
    public ApiResult<Map<String, Object>> board(@RequestAttribute("currentUser") String username) {
        return ApiResult.ok(recruitService.board(username));
    }

    @PostMapping("/recruit")
    public ApiResult<Map<String, Object>> recruit(@RequestAttribute("currentUser") String username,
                                                 @RequestBody(required = false) RecruitRequest req) {
        try {
            Map<String, Object> data = recruitService.recruit(username, req == null ? null : req.getHeroId());
            Object hero = data.get("hero");
            String name = hero instanceof Map ? String.valueOf(((Map<?, ?>) hero).get("name")) : "此将";
            return ApiResult.ok(name + " 已入帐下，听候调遣", data);
        } catch (IllegalArgumentException e) {
            return ApiResult.fail(e.getMessage());
        }
    }
}
