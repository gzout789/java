package com.fenglin.springboottest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 烽火快报
 */
@Data
@TableName("news")
public class News {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 快报正文 */
    private String content;

    /** 类别：军情 / 朝野 / 异象 */
    private String category;

    @TableField("sort_order")
    private Integer sortOrder;
}
