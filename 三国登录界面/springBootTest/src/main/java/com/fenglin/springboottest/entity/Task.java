package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 军机要务
 */
@Data
@TableName("task")
public class Task {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 要务内容 */
    private String title;

    /** 是否办毕 */
    private Boolean done;

    /** 类别：军务 / 内政 / 外交 */
    private String category;

    @TableField("sort_order")
    private Integer sortOrder;
}
