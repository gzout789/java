package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.service.SocialSupport;
import com.fenglin.springboottest.service.TeamService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.function.Supplier;

/** 联队房间接口：建队、邀人、入队、出征、频道消息、战报上报 */
@RestController
@RequestMapping("/api/team")
public class TeamController {

    private static final Logger log = LoggerFactory.getLogger(TeamController.class);

    private final TeamService service;

    public TeamController(TeamService service) {
        this.service = service;
    }

    private static String me(HttpServletRequest req) {
        return (String) req.getAttribute("currentUser");
    }

    private static String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private <T> ApiResult<T> run(Supplier<T> action) {
        try {
            return ApiResult.ok(action.get());
        } catch (IllegalArgumentException e) {
            return ApiResult.fail(e.getMessage());
        } catch (Exception e) {
            log.warn("联队接口异常：{}", e.getMessage());
            return ApiResult.fail("军中事务繁忙，请稍候再试");
        }
    }

    @GetMapping
    public ApiResult<Map<String, Object>> overview(HttpServletRequest req) {
        return run(() -> service.overview(me(req)));
    }

    @PostMapping("/create")
    public ApiResult<Map<String, Object>> create(
            @RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> service.create(me(req), str(body.get("name"))));
    }

    @PostMapping("/invite")
    public ApiResult<Void> invite(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.invite(me(req), str(body.get("username")));
            return null;
        });
    }

    @PostMapping("/invite/accept")
    public ApiResult<Void> acceptInvite(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.handleInvite(me(req), SocialSupport.toLong(body.get("id")), true);
            return null;
        });
    }

    @PostMapping("/invite/reject")
    public ApiResult<Void> rejectInvite(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.handleInvite(me(req), SocialSupport.toLong(body.get("id")), false);
            return null;
        });
    }

    @PostMapping("/join")
    public ApiResult<Map<String, Object>> join(
            @RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> service.join(me(req), str(body.get("code"))));
    }

    @PostMapping("/leave")
    public ApiResult<Void> leave(HttpServletRequest req) {
        return run(() -> {
            service.leave(me(req));
            return null;
        });
    }

    @PostMapping("/start")
    public ApiResult<Void> start(HttpServletRequest req) {
        return run(() -> {
            service.start(me(req));
            return null;
        });
    }

    @PostMapping("/messages/load")
    public ApiResult<Map<String, Object>> loadMessages(
            @RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> service.messages(me(req), SocialSupport.toLong(body.get("after"))));
    }

    @PostMapping("/messages")
    public ApiResult<Void> postMessage(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.postMessage(me(req), str(body.get("content")));
            return null;
        });
    }

    /** 游戏侧在一局结束后上报战报，同袍在房间频道里可见 */
    @PostMapping("/report")
    public ApiResult<Void> postReport(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.postReport(me(req), str(body.get("content")));
            return null;
        });
    }
}
