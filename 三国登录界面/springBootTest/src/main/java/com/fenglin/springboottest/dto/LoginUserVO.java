package com.fenglin.springboottest.dto;

import lombok.Data;

/**
 * 登录成功后返回给前端的将军档案
 */
@Data
public class LoginUserVO {

    private String username;
    private String faction;
    private String factionName;
    private String createTime;
    /** JWT，后续接口放在 Authorization: Bearer <token> */
    private String token;
}
