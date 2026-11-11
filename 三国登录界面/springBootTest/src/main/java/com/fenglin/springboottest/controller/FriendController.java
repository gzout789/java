package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.service.FriendService;
import com.fenglin.springboottest.service.SocialSupport;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * 同袍结交与私信接口，全部走 /api/** 的将军令牌鉴权。
 * 中文名号一律放在 JSON body 中传递，避免 URL 编码差异。
 */
@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private static final Logger log = LoggerFactory.getLogger(FriendController.class);

    private final FriendService service;

    public FriendController(FriendService service) {
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
            log.warn("同袍接口异常：{}", e.getMessage());
            return ApiResult.fail("军中事务繁忙，请稍候再试");
        }
    }

    /** 好友 + 结交帖 + 未读数，一次拿齐 */
    @GetMapping
    public ApiResult<Map<String, Object>> overview(HttpServletRequest req) {
        return run(() -> service.overview(me(req)));
    }

    @GetMapping("/search")
    public ApiResult<List<Map<String, Object>>> search(
            @RequestParam(defaultValue = "") String keyword, HttpServletRequest req) {
        return run(() -> service.search(me(req), keyword));
    }

    @PostMapping("/request")
    public ApiResult<Void> request(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.addRequest(me(req), str(body.get("username")), str(body.get("message")));
            return null;
        });
    }

    @PostMapping("/request/accept")
    public ApiResult<Void> accept(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.handleRequest(me(req), SocialSupport.toLong(body.get("id")), true);
            return null;
        });
    }

    @PostMapping("/request/reject")
    public ApiResult<Void> reject(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.handleRequest(me(req), SocialSupport.toLong(body.get("id")), false);
            return null;
        });
    }

    @PostMapping("/remove")
    public ApiResult<Void> remove(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.removeFriend(me(req), str(body.get("username")));
            return null;
        });
    }

    /** 增量私信，after 为已持有的最大消息 id */
    @PostMapping("/messages/load")
    public ApiResult<Map<String, Object>> loadMessages(
            @RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> service.messages(me(req), str(body.get("with")),
                SocialSupport.toLong(body.get("after"))));
    }

    @PostMapping("/messages")
    public ApiResult<Void> sendMessage(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        return run(() -> {
            service.sendMessage(me(req), str(body.get("to")), str(body.get("content")));
            return null;
        });
    }
}
