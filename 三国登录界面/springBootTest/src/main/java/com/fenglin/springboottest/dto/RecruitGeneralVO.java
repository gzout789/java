package com.fenglin.springboottest.dto;

import lombok.Data;

/**
 * 点将台里的一张武将牌：武将资料 + 招募状态
 */
@Data
public class RecruitGeneralVO {

    private Long id;
    private String name;
    private String epithet;
    private String faction;
    private String type;
    private String typeName;
    private String description;
    private Integer power;
    private Integer leadership;

    /** 招募所需军饷（石） */
    private Integer cost;

    /** 是否已入帐 */
    private Boolean recruited;

    /** 入帐时间，未招为 null */
    private String recruitedAt;

    /** 是否与当前将军同阵营（同阵营不涨价） */
    private Boolean sameFaction;
}
