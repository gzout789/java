package com.fenglin.springboottest.dto;

import lombok.Data;

@Data
public class RegisterRequest {

    private String username;
    private String password;
    /** han / wei / shu / wu */
    private String faction;
}
