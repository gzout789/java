package com.fenglin.springboottest.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fenglin.springboottest.dto.RecruitGeneralVO;
import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.Recruit;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.RecruitMapper;
import com.fenglin.springboottest.service.RecruitService;
import com.fenglin.springboottest.service.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 点将台：军饷 = 初始军饷 − 已招募武将的花费
 * 价格规则：100 + 武力×5 + 统率×5；非本阵营者再加价 50%（取整到十位）
 */
@Service
public class RecruitServiceImpl implements RecruitService {

    /** 初始军饷（石） */
    private static final int INITIAL_GOLD = 8000;

    /** 他阵营加价倍数 */
    private static final double FOREIGN_RATIO = 1.5;

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final UserService userService;
    private final HeroMapper heroMapper;
    private final RecruitMapper recruitMapper;

    public RecruitServiceImpl(UserService userService, HeroMapper heroMapper, RecruitMapper recruitMapper) {
        this.userService = userService;
        this.heroMapper = heroMapper;
        this.recruitMapper = recruitMapper;
    }

    @Override
    public Map<String, Object> board(String username) {
        User user = requireUser(username);
        int spent = spentOf(user.getId());
        int gold = Math.max(0, INITIAL_GOLD - spent);

        Map<Long, Recruit> mine = recruitMapper.selectList(
                        new LambdaQueryWrapper<Recruit>().eq(Recruit::getUserId, user.getId()))
                .stream()
                .collect(Collectors.toMap(Recruit::getHeroId, Function.identity(), (a, b) -> a));

        List<Hero> heroes = heroMapper.selectList(
                new LambdaQueryWrapper<Hero>().orderByAsc(Hero::getSortOrder).orderByAsc(Hero::getId));

        List<RecruitGeneralVO> generals = new ArrayList<>();
        for (Hero hero : heroes) {
            RecruitGeneralVO vo = toVO(hero, user.getFaction());
            Recruit rec = mine.get(hero.getId());
            if (rec != null) {
                vo.setRecruited(true);
                vo.setRecruitedAt(rec.getCreateTime() == null ? "" : rec.getCreateTime().format(TIME_FMT));
            }
            generals.add(vo);
        }
        // 未入帐的按军饷由低到高，已入帐的往后排
        generals.sort(Comparator
                .comparing(RecruitGeneralVO::getRecruited)
                .thenComparing(RecruitGeneralVO::getCost));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("initialGold", INITIAL_GOLD);
        data.put("gold", gold);
        data.put("spent", spent);
        data.put("recruitedCount", mine.size());
        data.put("faction", user.getFaction());
        data.put("generals", generals);
        return data;
    }

    @Override
    public Map<String, Object> recruit(String username, Long heroId) {
        User user = requireUser(username);
        if (heroId == null) {
            throw new IllegalArgumentException("请先择一位将军");
        }

        Hero hero = heroMapper.selectById(heroId);
        if (hero == null) {
            throw new IllegalArgumentException("榜上查无此将");
        }

        Long exists = recruitMapper.selectCount(new LambdaQueryWrapper<Recruit>()
                .eq(Recruit::getUserId, user.getId())
                .eq(Recruit::getHeroId, heroId));
        if (exists != null && exists > 0) {
            throw new IllegalArgumentException(hero.getName() + " 已在将军帐下，不必再招");
        }

        int cost = costOf(hero, user.getFaction());
        int gold = Math.max(0, INITIAL_GOLD - spentOf(user.getId()));
        if (gold < cost) {
            throw new IllegalArgumentException("军饷不足，尚差 " + (cost - gold) + " 石");
        }

        Recruit record = new Recruit();
        record.setUserId(user.getId());
        record.setHeroId(heroId);
        record.setCost(cost);
        record.setCreateTime(LocalDateTime.now());
        recruitMapper.insert(record);

        Map<String, Object> heroInfo = new LinkedHashMap<>();
        heroInfo.put("id", hero.getId());
        heroInfo.put("name", hero.getName());
        heroInfo.put("epithet", hero.getEpithet());
        heroInfo.put("faction", hero.getFaction());
        heroInfo.put("typeName", hero.getTypeName());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("gold", gold - cost);
        data.put("cost", cost);
        data.put("hero", heroInfo);
        return data;
    }

    private User requireUser(String username) {
        User user = userService.findByUsername(username);
        if (user == null) {
            throw new IllegalArgumentException("账号不存在，请重新点兵入帐");
        }
        return user;
    }

    private int spentOf(Long userId) {
        List<Recruit> list = recruitMapper.selectList(
                new LambdaQueryWrapper<Recruit>().eq(Recruit::getUserId, userId));
        return list.stream().mapToInt(r -> r.getCost() == null ? 0 : r.getCost()).sum();
    }

    private RecruitGeneralVO toVO(Hero hero, String userFaction) {
        RecruitGeneralVO vo = new RecruitGeneralVO();
        vo.setId(hero.getId());
        vo.setName(hero.getName());
        vo.setEpithet(hero.getEpithet());
        vo.setFaction(hero.getFaction());
        vo.setType(hero.getType());
        vo.setTypeName(hero.getTypeName());
        vo.setDescription(hero.getDescription());
        vo.setPower(hero.getPower());
        vo.setLeadership(hero.getLeadership());
        vo.setSameFaction(hero.getFaction() != null && hero.getFaction().equals(userFaction));
        vo.setCost(costOf(hero, userFaction));
        vo.setRecruited(false);
        return vo;
    }

    /** 价格：100 + 武力×5 + 统率×5，他阵营 +50% 后取整到十位 */
    private int costOf(Hero hero, String userFaction) {
        int power = hero.getPower() == null ? 0 : hero.getPower();
        int leadership = hero.getLeadership() == null ? 0 : hero.getLeadership();
        int base = 100 + power * 5 + leadership * 5;
        boolean same = hero.getFaction() != null && hero.getFaction().equals(userFaction);
        if (same) {
            return base;
        }
        return (int) (Math.ceil(base * FOREIGN_RATIO / 10.0) * 10);
    }
}
