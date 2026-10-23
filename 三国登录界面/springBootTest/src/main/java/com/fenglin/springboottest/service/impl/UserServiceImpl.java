package com.fenglin.springboottest.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.UserMapper;
import com.fenglin.springboottest.service.UserService;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    @Override
    public User findByUsername(String username) {
        return lambdaQuery().eq(User::getUsername, username).one();
    }

    @Override
    public Map<String, Long> countByFaction() {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("han", 0L);
        result.put("wei", 0L);
        result.put("shu", 0L);
        result.put("wu", 0L);

        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.select("faction", "COUNT(*) AS cnt").groupBy("faction");
        List<Map<String, Object>> rows = baseMapper.selectMaps(wrapper);
        for (Map<String, Object> row : rows) {
            Object faction = row.get("faction");
            Object cnt = row.get("cnt");
            if (faction != null) {
                String key = String.valueOf(faction);
                long value = cnt == null ? 0L : ((Number) cnt).longValue();
                // 兼容库中可能出现的旧阵营值，只统计四家
                result.put(key, result.getOrDefault(key, 0L) + value);
            }
        }
        return result;
    }
}
