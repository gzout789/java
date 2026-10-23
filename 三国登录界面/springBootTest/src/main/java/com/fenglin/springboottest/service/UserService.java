package com.fenglin.springboottest.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.fenglin.springboottest.entity.User;

public interface UserService extends IService<User> {

    /** 按将军名号查询账号 */
    User findByUsername(String username);

    /** 各阵营人数统计：key 为 han/wei/shu/wu */
    java.util.Map<String, Long> countByFaction();
}
