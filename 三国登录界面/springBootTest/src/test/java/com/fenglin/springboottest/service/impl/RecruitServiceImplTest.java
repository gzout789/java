package com.fenglin.springboottest.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.fenglin.springboottest.dto.RecruitGeneralVO;
import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.Recruit;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.GachaLogMapper;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.QuizEarningMapper;
import com.fenglin.springboottest.mapper.RecruitMapper;
import com.fenglin.springboottest.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * 点将台招募逻辑单元测试：价格规则、军饷不足、重复招募、他阵营加价。
 * 全部 mock mapper / service，纯内存，不连数据库。
 */
class RecruitServiceImplTest {

    private RecruitServiceImpl service;
    private UserService userService;
    private HeroMapper heroMapper;
    private RecruitMapper recruitMapper;
    private GachaLogMapper gachaLogMapper;
    private QuizEarningMapper quizEarningMapper;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        heroMapper = mock(HeroMapper.class);
        recruitMapper = mock(RecruitMapper.class);
        gachaLogMapper = mock(GachaLogMapper.class);
        quizEarningMapper = mock(QuizEarningMapper.class);
        // 默认无抽卡流水、无答题收益
        when(gachaLogMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());
        when(quizEarningMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());
        service = new RecruitServiceImpl(userService, heroMapper, recruitMapper, gachaLogMapper, quizEarningMapper);
    }

    private User user(String name, String faction) {
        User u = new User();
        u.setId(1L);
        u.setUsername(name);
        u.setFaction(faction);
        return u;
    }

    private Hero hero(String name, String faction, int power, int leadership) {
        Hero h = new Hero();
        h.setId(100L);
        h.setName(name);
        h.setFaction(faction);
        h.setPower(power);
        h.setLeadership(leadership);
        h.setType("猛将");
        h.setTypeName("猛将");
        return h;
    }

    @Test
    void recruit_sameFaction_computesBaseCost() {
        // 吕布 han，武力100 统率87 → base = 100 + 500 + 435 = 1035
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        when(heroMapper.selectById(100L)).thenReturn(lvbu);
        when(recruitMapper.selectCount(any())).thenReturn(0L);
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());

        Map<String, Object> result = service.recruit("云长", 100L);

        assertEquals(1035, result.get("cost"));
        assertEquals(8000 - 1035, result.get("gold"));
        // 验证插入的招募记录 cost 正确
        verify(recruitMapper).insert(argThat((Recruit r) -> r.getCost() == 1035));
    }

    @Test
    void recruit_foreignFaction_addsFiftyPercent() {
        // 吕布 han，蜀汉用户招 → 1035 × 1.5 = 1552.5 → ceil 到十位 = 1560
        when(userService.findByUsername("云长")).thenReturn(user("云长", "shu"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        when(heroMapper.selectById(100L)).thenReturn(lvbu);
        when(recruitMapper.selectCount(any())).thenReturn(0L);
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());

        Map<String, Object> result = service.recruit("云长", 100L);

        assertEquals(1560, result.get("cost"));
    }

    @Test
    void recruit_insufficientGold_throws() {
        // 用一个天价武将：武力100 统率100 → base = 1100，仍低于 8000。
        // 改为预先让 spentOf 很大：mock 返回已招募记录，花费 8000。
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        when(heroMapper.selectById(100L)).thenReturn(lvbu);
        when(recruitMapper.selectCount(any())).thenReturn(0L);

        Recruit expensive = new Recruit();
        expensive.setUserId(1L);
        expensive.setHeroId(1L);
        expensive.setCost(8000);
        when(recruitMapper.selectList(any(Wrapper.class)))
                .thenReturn(List.of(expensive));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.recruit("云长", 100L));
        assertTrue(ex.getMessage().contains("军饷不足"));
    }

    @Test
    void recruit_duplicate_throws() {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        when(heroMapper.selectById(100L)).thenReturn(lvbu);
        when(recruitMapper.selectCount(any())).thenReturn(1L); // 已招募

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.recruit("云长", 100L));
        assertTrue(ex.getMessage().contains("已在将军帐下"));
    }

    @Test
    void recruit_unknownUser_throws() {
        when(userService.findByUsername("不存在")).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.recruit("不存在", 100L));
    }

    @Test
    void board_listsGeneralsWithCostAndFaction() {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        Hero zhugeliang = hero("诸葛亮", "shu", 38, 95);
        when(heroMapper.selectList(any(Wrapper.class)))
                .thenReturn(List.of(lvbu, zhugeliang));
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());

        Map<String, Object> board = service.board("云长");

        assertEquals(8000, board.get("initialGold"));
        assertEquals(8000, board.get("gold"));
        assertEquals(0, board.get("recruitedCount"));

        @SuppressWarnings("unchecked")
        List<RecruitGeneralVO> generals = (List<RecruitGeneralVO>) board.get("generals");
        assertEquals(2, generals.size());

        // 吕布是 han（本阵营），base = 100 + 100×5 + 87×5 = 1035，不加价
        RecruitGeneralVO lvbuVO = generals.stream()
                .filter(g -> "吕布".equals(g.getName())).findFirst().orElseThrow();
        assertTrue(lvbuVO.getSameFaction());
        assertEquals(1035, lvbuVO.getCost());

        // 诸葛亮是 shu（他阵营），base = 100 + 38×5 + 95×5 = 765 → 加价 ceil(765×1.5/10)×10 = 1150
        RecruitGeneralVO zgl = generals.stream()
                .filter(g -> "诸葛亮".equals(g.getName())).findFirst().orElseThrow();
        assertFalse(zgl.getSameFaction());
        assertEquals(1150, zgl.getCost());
    }

    @Test
    void gacha_single_insufficientGold_throws() {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));

        // 已用尽军饷（招募花费 8000）
        Recruit expensive = new Recruit();
        expensive.setUserId(1L);
        expensive.setHeroId(1L);
        expensive.setCost(8000);
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(List.of(expensive));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class, () -> service.gacha("云长", 1));
        assertTrue(ex.getMessage().contains("军饷不足"));
    }

    @Test
    void gacha_single_drawsHeroAndReturnsResults() {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        Hero lvbu = hero("吕布", "han", 100, 87);
        Hero zhao = hero("赵云", "shu", 96, 88);
        when(heroMapper.selectList(any(Wrapper.class))).thenReturn(List.of(lvbu, zhao));
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(Collections.emptyList());

        Map<String, Object> result = service.gacha("云长", 1);

        assertEquals(500, result.get("cost"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("results");
        assertEquals(1, results.size());
        // 抽到的一定是这两位之一（未拥有，gained=1）
        assertEquals(1, result.get("gained"));
        // 至少插入一条 recruit 记录（新武将入帐）
        verify(recruitMapper, atLeastOnce()).insert(any(Recruit.class));
    }

    @Test
    void gacha_invalidCount_throws() {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));
        assertThrows(IllegalArgumentException.class, () -> service.gacha("云长", 3));
    }

    private Hero heroWithId(long id, String name, String faction, int power, int leadership) {
        Hero h = new Hero();
        h.setId(id);
        h.setName(name);
        h.setFaction(faction);
        h.setPower(power);
        h.setLeadership(leadership);
        h.setType("猛将");
        h.setTypeName("猛将");
        return h;
    }

    @Test
    void gacha_ten_allDuplicates_lastOneGuaranteedUnowned() throws Exception {
        when(userService.findByUsername("云长")).thenReturn(user("云长", "han"));

        // 武将池：1 号已拥有，2 号未拥有
        Hero owned = heroWithId(1L, "吕布", "han", 100, 87);
        Hero unowned = heroWithId(2L, "赵云", "shu", 96, 88);
        when(heroMapper.selectList(any(Wrapper.class))).thenReturn(List.of(owned, unowned));

        Recruit existing = new Recruit();
        existing.setUserId(1L);
        existing.setHeroId(1L);
        existing.setCost(0);
        when(recruitMapper.selectList(any(Wrapper.class))).thenReturn(List.of(existing));

        // 用反射替换 Random，让前 9 次 nextInt 都指向「已拥有」的 1 号（index 0），
        // 从而确定性地走到保底分支：第 10 次从未拥有池抽出 2 号。
        java.util.Random fixed = mock(java.util.Random.class);
        // allHeroes.size()==2：前 9 次返回 0（抽到 1 号重复）；保底分支 nextInt(unownedPool.size()==1) 返回 0
        when(fixed.nextInt(2)).thenReturn(0);
        when(fixed.nextInt(1)).thenReturn(0);
        java.lang.reflect.Field f = RecruitServiceImpl.class.getDeclaredField("random");
        f.setAccessible(true);
        f.set(service, fixed);

        Map<String, Object> result = service.gacha("云长", 10);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("results");
        assertEquals(10, results.size());
        // 十连保底：最后一抽必定是未拥有的 2 号
        Map<String, Object> last = results.get(results.size() - 1);
        assertEquals(2L, ((Number) last.get("id")).longValue());
        assertEquals(Boolean.TRUE, last.get("pity"));
        assertEquals(Boolean.FALSE, last.get("duplicate"));
        assertEquals(1, result.get("gained"));
    }
}
