package com.fenglin.springboottest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fenglin.springboottest.entity.Hero;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface HeroMapper extends BaseMapper<Hero> {
}
