package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 学识问道题库（三国历史知识）
 */
@Data
@TableName("quiz_question")
public class QuizQuestion {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 题目正文 */
    private String question;

    /** 选项 A */
    @TableField("option_a")
    private String optionA;

    /** 选项 B */
    @TableField("option_b")
    private String optionB;

    /** 选项 C */
    @TableField("option_c")
    private String optionC;

    /** 选项 D */
    @TableField("option_d")
    private String optionD;

    /** 正确答案：A/B/C/D */
    private String answer;

    /** 知识点解析（答完展示，寓教于乐） */
    private String explanation;

    /** 答题奖励军饷（石） */
    private Integer reward;

    /** 分类：典故 / 人物 / 地理 / 兵制 */
    private String category;

    @TableField("sort_order")
    private Integer sortOrder;
}
