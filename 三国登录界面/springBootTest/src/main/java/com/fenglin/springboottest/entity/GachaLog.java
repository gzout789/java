package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 抽卡流水记录（每次单抽/十连各记一条）
 */
@Data
@TableName("gacha_log")
public class GachaLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("hero_id")
    private Long heroId;

    /** 本次消耗军饷（石） */
    private Integer cost;

    /** 重复武将返还军饷（石） */
    private Integer refund;

    @TableField("create_time")
    private LocalDateTime createTime;
}
