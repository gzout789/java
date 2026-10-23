package com.fenglin.springboottest.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.News;
import com.fenglin.springboottest.entity.Task;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.NewsMapper;
import com.fenglin.springboottest.mapper.TaskMapper;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 大帐内容接口：英雄榜 / 军机要务 / 烽火快报 / 全局搜索
 * 全部需要 Authorization: Bearer <token>
 */
@RestController
@RequestMapping("/api")
public class ContentController {

    private final HeroMapper heroMapper;
    private final TaskMapper taskMapper;
    private final NewsMapper newsMapper;

    public ContentController(HeroMapper heroMapper, TaskMapper taskMapper, NewsMapper newsMapper) {
        this.heroMapper = heroMapper;
        this.taskMapper = taskMapper;
        this.newsMapper = newsMapper;
    }

    @GetMapping("/heroes")
    public ApiResult<List<Hero>> heroes(@RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String faction,
                                        @RequestParam(required = false) String type) {
        LambdaQueryWrapper<Hero> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(Hero::getName, kw)
                    .or().like(Hero::getEpithet, kw)
                    .or().like(Hero::getDescription, kw));
        }
        if (StringUtils.hasText(faction) && !"all".equals(faction)) {
            wrapper.eq(Hero::getFaction, faction);
        }
        if (StringUtils.hasText(type) && !"all".equals(type)) {
            wrapper.eq(Hero::getType, type);
        }
        wrapper.orderByAsc(Hero::getSortOrder).orderByAsc(Hero::getId);
        return ApiResult.ok(heroMapper.selectList(wrapper));
    }

    /** 筛选项元数据：阵营列表 + 兵种类型（含数量与所属阵营） */
    @GetMapping("/heroes/meta")
    public ApiResult<Map<String, Object>> heroesMeta() {
        List<Hero> all = heroMapper.selectList(
                new LambdaQueryWrapper<Hero>().orderByAsc(Hero::getSortOrder));

        List<Map<String, Object>> factions = new ArrayList<>();
        factions.add(factionMeta("han", "汉室"));
        factions.add(factionMeta("wei", "曹魏"));
        factions.add(factionMeta("shu", "蜀汉"));
        factions.add(factionMeta("wu", "东吴"));

        // 按 type 聚合，保持武将表的自然顺序
        Map<String, List<Hero>> grouped = new LinkedHashMap<>();
        for (Hero hero : all) {
            String type = StringUtils.hasText(hero.getType()) ? hero.getType() : "未分类";
            grouped.computeIfAbsent(type, k -> new ArrayList<>()).add(hero);
        }

        List<Map<String, Object>> types = new ArrayList<>();
        for (Map.Entry<String, List<Hero>> entry : grouped.entrySet()) {
            Set<String> fs = new LinkedHashSet<>();
            for (Hero hero : entry.getValue()) {
                if (StringUtils.hasText(hero.getFaction())) {
                    fs.add(hero.getFaction());
                }
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", entry.getKey());
            item.put("count", entry.getValue().size());
            item.put("factions", new ArrayList<>(fs));
            types.add(item);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("factions", factions);
        data.put("types", types);
        return ApiResult.ok(data);
    }

    private Map<String, Object> factionMeta(String key, String name) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", key);
        item.put("name", name);
        return item;
    }

    @GetMapping("/tasks")
    public ApiResult<List<Task>> tasks(@RequestParam(required = false) String keyword,
                                       @RequestParam(required = false) String category) {
        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Task::getTitle, keyword.trim());
        }
        if (StringUtils.hasText(category) && !"all".equals(category)) {
            wrapper.eq(Task::getCategory, category);
        }
        wrapper.orderByAsc(Task::getSortOrder).orderByAsc(Task::getId);
        return ApiResult.ok(taskMapper.selectList(wrapper));
    }

    @GetMapping("/news")
    public ApiResult<List<News>> news(@RequestParam(required = false) String keyword,
                                      @RequestParam(required = false) String category) {
        LambdaQueryWrapper<News> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(News::getContent, keyword.trim());
        }
        if (StringUtils.hasText(category) && !"all".equals(category)) {
            wrapper.eq(News::getCategory, category);
        }
        wrapper.orderByAsc(News::getSortOrder).orderByAsc(News::getId);
        return ApiResult.ok(newsMapper.selectList(wrapper));
    }

    /** 全局搜索：三类内容各取前若干条 */
    @GetMapping("/search")
    public ApiResult<Map<String, Object>> search(@RequestParam(required = false) String keyword) {
        Map<String, Object> data = new LinkedHashMap<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.isEmpty()) {
            data.put("heroes", List.of());
            data.put("tasks", List.of());
            data.put("news", List.of());
            return ApiResult.ok(data);
        }

        List<Hero> heroes = heroMapper.selectList(new LambdaQueryWrapper<Hero>()
                .and(w -> w.like(Hero::getName, kw)
                        .or().like(Hero::getEpithet, kw)
                        .or().like(Hero::getDescription, kw))
                .orderByAsc(Hero::getSortOrder)
                .last("LIMIT 5"));
        List<Task> tasks = taskMapper.selectList(new LambdaQueryWrapper<Task>()
                .like(Task::getTitle, kw)
                .orderByAsc(Task::getSortOrder)
                .last("LIMIT 5"));
        List<News> news = newsMapper.selectList(new LambdaQueryWrapper<News>()
                .like(News::getContent, kw)
                .orderByAsc(News::getSortOrder)
                .last("LIMIT 5"));

        data.put("heroes", heroes);
        data.put("tasks", tasks);
        data.put("news", news);
        return ApiResult.ok(data);
    }
}
