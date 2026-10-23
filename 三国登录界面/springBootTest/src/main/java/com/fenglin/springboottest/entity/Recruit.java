package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 点将台招募记录（一位将军招募一位武将只有一条）
 */
@Data
@TableName("recruit")
public class Recruit {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("hero_id")
    private Long heroId;

    /** 招募时耗费的军饷 */
    private Integer cost;

    @TableField("create_time")
    private LocalDateTime createTime;
}
