package com.fenglin.springboottest.controller;

import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.service.QuizService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 学识问道：学习三国历史知识 + 答题得军饷（需登录）
 */
@RestController
@RequestMapping("/api/quiz")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @GetMapping("/board")
    public ApiResult<Map<String, Object>> board(@RequestAttribute("currentUser") String username) {
        return ApiResult.ok(quizService.board(username));
    }

    @PostMapping("/answer")
    public ApiResult<Map<String, Object>> answer(@RequestAttribute("currentUser") String username,
                                                 @RequestBody(required = false) Map<String, Object> body) {
        try {
            Long questionId = body == null ? null : toLong(body.get("questionId"));
            String choice = body == null ? null : String.valueOf(body.get("choice"));
            Map<String, Object> data = quizService.answer(username, questionId, choice);
            boolean correct = Boolean.TRUE.equals(data.get("correct"));
            Object reward = data.get("reward");
            String msg = correct
                    ? "答对啦！赏军饷 " + reward + " 石"
                    : "此题有误，且看解析再战";
            return ApiResult.ok(msg, data);
        } catch (IllegalArgumentException e) {
            return ApiResult.fail(e.getMessage());
        }
    }

    private Long toLong(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Number) {
            return ((Number) o).longValue();
        }
        try {
            return Long.parseLong(String.valueOf(o));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
