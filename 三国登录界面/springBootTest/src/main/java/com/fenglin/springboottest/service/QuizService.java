package com.fenglin.springboottest.service;

import java.util.Map;

/**
 * 学识问道：学习三国历史知识 + 答题得军饷
 */
public interface QuizService {

    /**
     * 取答题面板数据：题库、已答题 ID 集合、累计收益、当前军饷
     */
    Map<String, Object> board(String username);

    /**
     * 提交答案：答对发放军饷（同题不可重复答），返回对错与解析
     *
     * @param username 当前将军
     * @param questionId 题目 ID
     * @param choice 用户选项 A/B/C/D
     */
    Map<String, Object> answer(String username, Long questionId, String choice);
}
