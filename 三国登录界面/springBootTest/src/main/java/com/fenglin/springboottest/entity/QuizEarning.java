package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 答题军饷收益流水：答对一题记一条（用于累计 earned 与防重复答题）
 */
@Data
@TableName("quiz_earning")
public class QuizEarning {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("question_id")
    private Long questionId;

    /** 本次获得的军饷（石） */
    private Integer reward;

    @TableField("create_time")
    private LocalDateTime createTime;
}
