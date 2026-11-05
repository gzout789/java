package com.fenglin.springboottest.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fenglin.springboottest.entity.QuizEarning;
import com.fenglin.springboottest.entity.QuizQuestion;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.QuizEarningMapper;
import com.fenglin.springboottest.mapper.QuizQuestionMapper;
import com.fenglin.springboottest.service.QuizService;
import com.fenglin.springboottest.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 学识问道实现。
 * 军饷收益只累加、不设上限，通过 quiz_earning 流水累计 earned。
 * 同一题目答对即锁定，不可重复刷军饷。
 */
@Service
public class QuizServiceImpl implements QuizService {

    private final UserService userService;
    private final QuizQuestionMapper questionMapper;
    private final QuizEarningMapper earningMapper;

    public QuizServiceImpl(UserService userService,
                           QuizQuestionMapper questionMapper,
                           QuizEarningMapper earningMapper) {
        this.userService = userService;
        this.questionMapper = questionMapper;
        this.earningMapper = earningMapper;
    }

    @Override
    public Map<String, Object> board(String username) {
        User user = requireUser(username);

        List<QuizQuestion> questions = questionMapper.selectList(
                new LambdaQueryWrapper<QuizQuestion>()
                        .orderByAsc(QuizQuestion::getSortOrder)
                        .orderByAsc(QuizQuestion::getId));

        Set<Long> answered = answeredIds(user.getId());
        int earned = earnedOf(user.getId());
        int answeredCount = answered.size();

        // 出给前端的题目：不暴露正确答案
        List<Map<String, Object>> list = new ArrayList<>();
        for (QuizQuestion q : questions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("question", q.getQuestion());
            m.put("optionA", q.getOptionA());
            m.put("optionB", q.getOptionB());
            m.put("optionC", q.getOptionC());
            m.put("optionD", q.getOptionD());
            m.put("reward", q.getReward());
            m.put("category", q.getCategory());
            m.put("answered", answered.contains(q.getId()));
            list.add(m);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questions", list);
        data.put("total", list.size());
        data.put("answeredCount", answeredCount);
        data.put("earned", earned);
        return data;
    }

    @Override
    public Map<String, Object> answer(String username, Long questionId, String choice) {
        User user = requireUser(username);
        if (questionId == null) {
            throw new IllegalArgumentException("请先择一题作答");
        }
        if (!StringUtils.hasText(choice)) {
            throw new IllegalArgumentException("请先选定答案");
        }
        String picked = choice.trim().toUpperCase();
        if (!picked.matches("[ABCD]")) {
            throw new IllegalArgumentException("选项有误");
        }

        QuizQuestion q = questionMapper.selectById(questionId);
        if (q == null) {
            throw new IllegalArgumentException("此题已佚，另择一题");
        }

        Set<Long> answered = answeredIds(user.getId());
        boolean already = answered.contains(questionId);
        boolean correct = picked.equalsIgnoreCase(q.getAnswer());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questionId", q.getId());
        data.put("correct", correct);
        data.put("answer", q.getAnswer());
        data.put("explanation", q.getExplanation());

        if (already) {
            // 已答过：不再发军饷，仅回显对错与解析
            data.put("reward", 0);
            data.put("repeat", true);
            data.put("earned", earnedOf(user.getId()));
            return data;
        }

        if (correct) {
            int reward = q.getReward() == null ? 0 : q.getReward();
            QuizEarning e = new QuizEarning();
            e.setUserId(user.getId());
            e.setQuestionId(questionId);
            e.setReward(reward);
            e.setCreateTime(LocalDateTime.now());
            earningMapper.insert(e);
            data.put("reward", reward);
        } else {
            data.put("reward", 0);
        }
        data.put("repeat", false);
        data.put("earned", earnedOf(user.getId()));
        return data;
    }

    private User requireUser(String username) {
        User user = userService.findByUsername(username);
        if (user == null) {
            throw new IllegalArgumentException("账号不存在，请重新点兵入帐");
        }
        return user;
    }

    private Set<Long> answeredIds(Long userId) {
        return earningMapper.selectList(
                        new LambdaQueryWrapper<QuizEarning>().eq(QuizEarning::getUserId, userId))
                .stream().map(QuizEarning::getQuestionId).collect(Collectors.toSet());
    }

    private int earnedOf(Long userId) {
        return earningMapper.selectList(
                        new LambdaQueryWrapper<QuizEarning>().eq(QuizEarning::getUserId, userId))
                .stream().mapToInt(e -> e.getReward() == null ? 0 : e.getReward()).sum();
    }
}
