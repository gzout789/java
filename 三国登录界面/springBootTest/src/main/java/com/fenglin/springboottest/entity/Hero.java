package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 英雄榜武将
 */
@Data
@TableName("hero")
public class Hero {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 姓名 */
    private String name;

    /** 称号，如「武圣」 */
    private String epithet;

    /** 阵营：han / wei / shu / wu */
    private String faction;

    /** 类型：君主 / 军师 / 猛将 / 统帅 */
    private String type;

    /** 类型中文名（前端直接展示） */
    @TableField("type_name")
    private String typeName;

    /** 小传 */
    private String description;

    /** 武力 */
    private Integer power;

    /** 统率 */
    private Integer leadership;

    /** 排序 */
    @TableField("sort_order")
    private Integer sortOrder;

    /* ==================== 烽烟三国杀 ==================== */

    /** 体力上限（勾玉数），游戏用，建议 3 - 5；汉主坐朝时 +1 */
    private Integer hp;

    /** 武将技名称，如「武圣」 */
    @TableField("skill_name")
    private String skillName;

    /** 武将技类型：常策 / 奇谋 / 应策 / 秘计 */
    @TableField("skill_type")
    private String skillType;

    /** 武将技效果描述 */
    @TableField("skill_desc")
    private String skillDesc;
}
