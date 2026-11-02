package com.fenglin.springboottest.service;

import java.util.Map;

public interface RecruitService {

    /** 点将台总览：军饷、帐下诸将、候选武将 */
    Map<String, Object> board(String username);

    /** 招募一位武将；业务不通过时抛 IllegalArgumentException（message 直接给前端展示） */
    Map<String, Object> recruit(String username, Long heroId);

    /** 抽卡：单抽 count=1、十连 count=10；重复武将折算军饷返还 */
    Map<String, Object> gacha(String username, int count);
}
