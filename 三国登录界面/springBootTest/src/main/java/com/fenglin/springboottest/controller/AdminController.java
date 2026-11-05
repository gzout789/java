package com.fenglin.springboottest.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fenglin.springboottest.common.ApiResult;
import com.fenglin.springboottest.dto.LoginRequest;
import com.fenglin.springboottest.entity.AdminUser;
import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.News;
import com.fenglin.springboottest.entity.QuizQuestion;
import com.fenglin.springboottest.entity.Recruit;
import com.fenglin.springboottest.entity.Task;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.AdminUserMapper;
import com.fenglin.springboottest.mapper.GachaLogMapper;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.NewsMapper;
import com.fenglin.springboottest.mapper.QuizQuestionMapper;
import com.fenglin.springboottest.mapper.RecruitMapper;
import com.fenglin.springboottest.mapper.TaskMapper;
import com.fenglin.springboottest.mapper.UserMapper;
import com.fenglin.springboottest.security.JwtUtil;
import com.fenglin.springboottest.security.LoginRateLimiter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 后台管理系统接口：英雄榜数据维护
 * 除 /api/admin/login 外均要求管理令牌（role=admin），由 AdminAuthInterceptor 守护。
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final Map<String, String> FACTION_NAMES = new LinkedHashMap<>();

    /** 英雄榜已有类型，前端下拉直接复用 */
    private static final List<String> HERO_TYPES = List.of("君主", "军师", "猛将", "统帅");

    /** 烽烟三国杀的技能分类：常策=锁定技，奇谋=主动技，应策=响应技，秘计=限定技 */
    private static final List<String> SKILL_TYPES = List.of("常策", "奇谋", "应策", "秘计");

    static {
        FACTION_NAMES.put("han", "汉室");
        FACTION_NAMES.put("wei", "曹魏");
        FACTION_NAMES.put("shu", "蜀汉");
        FACTION_NAMES.put("wu", "东吴");
    }

    private final AdminUserMapper adminUserMapper;
    private final HeroMapper heroMapper;
    private final RecruitMapper recruitMapper;
    private final TaskMapper taskMapper;
    private final NewsMapper newsMapper;
    private final QuizQuestionMapper quizQuestionMapper;
    private final UserMapper userMapper;
    private final GachaLogMapper gachaLogMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginRateLimiter rateLimiter;

    public AdminController(AdminUserMapper adminUserMapper, HeroMapper heroMapper,
                           RecruitMapper recruitMapper, TaskMapper taskMapper, NewsMapper newsMapper,
                           QuizQuestionMapper quizQuestionMapper, UserMapper userMapper,
                           GachaLogMapper gachaLogMapper, PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                           LoginRateLimiter rateLimiter) {
        this.adminUserMapper = adminUserMapper;
        this.heroMapper = heroMapper;
        this.recruitMapper = recruitMapper;
        this.taskMapper = taskMapper;
        this.newsMapper = newsMapper;
        this.quizQuestionMapper = quizQuestionMapper;
        this.userMapper = userMapper;
        this.gachaLogMapper = gachaLogMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.rateLimiter = rateLimiter;
    }

    /* ==================== 登录 ==================== */

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody LoginRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();

        if (username.isEmpty() || password.isEmpty()) {
            return ApiResult.fail("管理账号与密码皆不可为空");
        }

        AdminUser admin = adminUserMapper.selectOne(
                new LambdaQueryWrapper<AdminUser>().eq(AdminUser::getUsername, username));
        if (admin == null || !passwordEncoder.matches(password, admin.getPassword())) {
            boolean locked = rateLimiter.recordAccountFailure(username);
            if (locked) {
                return ApiResult.fail("此管理账号尝试过多，已暂时锁定，请稍后再试");
            }
            return ApiResult.fail("管理账号或密码有误");
        }

        // 登录成功，清除失败计数
        rateLimiter.clearAccount(username);

        // 记录最近登录时间，失败不影响登录本身
        try {
            AdminUser patch = new AdminUser();
            patch.setId(admin.getId());
            patch.setLastLogin(LocalDateTime.now());
            adminUserMapper.updateById(patch);
        } catch (Exception ignored) {
            /* 忽略 */
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", admin.getUsername());
        data.put("role", admin.getRole());
        data.put("remark", admin.getRemark());
        data.put("lastLogin", admin.getLastLogin() == null ? "" : admin.getLastLogin().format(TIME_FMT));
        data.put("token", jwtUtil.createAdmin(admin.getUsername()));
        return ApiResult.ok("入主中军帐，管理权已授", data);
    }

    /* ==================== 英雄榜查询 ==================== */

    @GetMapping("/heroes")
    public ApiResult<List<Hero>> heroes(@RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String faction,
                                        @RequestParam(required = false) String type) {
        return ApiResult.ok(heroMapper.selectList(heroQuery(keyword, faction, type)));
    }

    /** 后台筛选项与看板数字 */
    @GetMapping("/meta")
    public ApiResult<Map<String, Object>> meta() {
        List<Hero> all = heroMapper.selectList(
                new LambdaQueryWrapper<Hero>().orderByAsc(Hero::getSortOrder).orderByAsc(Hero::getId));

        Map<String, Long> byFaction = new LinkedHashMap<>();
        FACTION_NAMES.keySet().forEach(k -> byFaction.put(k, 0L));
        Map<String, Long> byType = new LinkedHashMap<>();
        Set<String> extraTypes = new LinkedHashSet<>();
        int powerSum = 0;
        int powerCount = 0;
        Hero top = null;

        for (Hero hero : all) {
            if (hero.getFaction() != null) {
                byFaction.merge(hero.getFaction(), 1L, Long::sum);
            }
            String type = StringUtils.hasText(hero.getType()) ? hero.getType() : "未分类";
            byType.merge(type, 1L, Long::sum);
            if (!HERO_TYPES.contains(type)) {
                extraTypes.add(type);
            }
            if (hero.getPower() != null) {
                powerSum += hero.getPower();
                powerCount++;
                if (top == null || hero.getPower() > top.getPower()) {
                    top = hero;
                }
            }
        }

        List<Map<String, Object>> factions = new ArrayList<>();
        FACTION_NAMES.forEach((key, name) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("name", name);
            item.put("count", byFaction.getOrDefault(key, 0L));
            factions.add(item);
        });

        // 类型选项：预置四种 + 库中已有的自定义类型，避免编辑时丢选项
        List<String> typeOptions = new ArrayList<>(HERO_TYPES);
        extraTypes.forEach(t -> typeOptions.add(t));

        List<Map<String, Object>> typeList = new ArrayList<>();
        byType.entrySet().stream()
                .sorted(Comparator.comparingLong((Map.Entry<String, Long> e) -> e.getValue()).reversed())
                .forEach(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("name", e.getKey());
                    item.put("count", e.getValue());
                    typeList.add(item);
                });

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", all.size());
        data.put("factions", factions);
        data.put("types", typeList);
        data.put("typeOptions", typeOptions);
        data.put("avgPower", powerCount == 0 ? 0 : Math.round(powerSum * 10.0 / powerCount) / 10.0);
        data.put("topHero", top == null ? "" : top.getName());
        data.put("skillTypes", SKILL_TYPES);
        // 内容看板：各模块条目数
        data.put("taskCount", taskMapper.selectCount(null));
        data.put("newsCount", newsMapper.selectCount(null));
        data.put("quizCount", quizQuestionMapper.selectCount(null));
        // 账号看板
        data.put("userCount", userMapper.selectCount(null));
        data.put("recruitCount", recruitMapper.selectCount(null));
        data.put("gachaCount", gachaLogMapper.selectCount(null));
        return ApiResult.ok(data);
    }

    /* ==================== 英雄榜增删改 ==================== */

    @PostMapping("/heroes")
    public ApiResult<Hero> create(@RequestBody Hero form) {
        String error = validate(form, null);
        if (error != null) {
            return ApiResult.fail(error);
        }
        normalize(form);
        // 未指定排序时排到末尾，保持榜单顺序稳定
        if (form.getSortOrder() == null) {
            Hero last = heroMapper.selectOne(new LambdaQueryWrapper<Hero>()
                    .orderByDesc(Hero::getSortOrder).last("LIMIT 1"));
            form.setSortOrder(last == null || last.getSortOrder() == null ? 1 : last.getSortOrder() + 1);
        }
        heroMapper.insert(form);
        return ApiResult.ok("「" + form.getName() + "」已录入英雄榜", form);
    }

    @PutMapping("/heroes/{id}")
    public ApiResult<Hero> update(@PathVariable Long id, @RequestBody Hero form) {
        Hero exists = heroMapper.selectById(id);
        if (exists == null) {
            return ApiResult.fail("该武将不在榜上，可能已被移除");
        }
        String error = validate(form, id);
        if (error != null) {
            return ApiResult.fail(error);
        }
        form.setId(id);
        normalize(form);
        if (form.getSortOrder() == null) {
            form.setSortOrder(exists.getSortOrder());
        }
        heroMapper.updateById(form);
        return ApiResult.ok("「" + form.getName() + "」已更新", heroMapper.selectById(id));
    }

    @DeleteMapping("/heroes/{id}")
    @Transactional
    public ApiResult<Void> delete(@PathVariable Long id) {
        Hero exists = heroMapper.selectById(id);
        if (exists == null) {
            return ApiResult.fail("该武将不在榜上，可能已被移除");
        }
        // 武将下榜时清理招募记录，避免点将台读到悬空的英雄 ID
        Long recruitCount = recruitMapper.selectCount(
                new LambdaQueryWrapper<Recruit>().eq(Recruit::getHeroId, id));
        if (recruitCount != null && recruitCount > 0) {
            recruitMapper.delete(new LambdaQueryWrapper<Recruit>().eq(Recruit::getHeroId, id));
        }
        heroMapper.deleteById(id);
        String tail = recruitCount == null || recruitCount == 0
                ? ""
                : "，并解除 " + recruitCount + " 条招募记录";
        return ApiResult.ok("「" + exists.getName() + "」已从英雄榜移除" + tail, null);
    }

    /* ==================== 校验 ==================== */

    /**
     * @param selfId 更新时传自身 ID，用于同名检查时排除自己
     * @return 错误提示；通过返回 null
     */
    private String validate(Hero form, Long selfId) {
        if (form == null) {
            return "提交内容为空";
        }
        String name = form.getName() == null ? "" : form.getName().trim();
        if (name.isEmpty()) {
            return "将军姓名不可为空";
        }
        if (name.length() > 20) {
            return "姓名不超过二十字";
        }
        if (!StringUtils.hasText(form.getFaction()) || !FACTION_NAMES.containsKey(form.getFaction().trim())) {
            return "请选择有效阵营";
        }
        if (!StringUtils.hasText(form.getType())) {
            return "请选择武将类型";
        }
        if (form.getType().trim().length() > 10) {
            return "类型名不超过十字";
        }
        String epithet = form.getEpithet() == null ? "" : form.getEpithet().trim();
        if (epithet.length() > 20) {
            return "称号不超过二十字";
        }
        if (form.getDescription() != null && form.getDescription().trim().length() > 200) {
            return "小传不超过二百字";
        }
        if (form.getPower() != null && (form.getPower() < 0 || form.getPower() > 100)) {
            return "武力需在 0 - 100 之间";
        }
        if (form.getLeadership() != null && (form.getLeadership() < 0 || form.getLeadership() > 100)) {
            return "统率需在 0 - 100 之间";
        }
        if (form.getSortOrder() != null && (form.getSortOrder() < 0 || form.getSortOrder() > 9999)) {
            return "排序需在 0 - 9999 之间";
        }
        // ---- 烽烟三国杀：体力与武将技 ----
        if (form.getHp() != null && (form.getHp() < 1 || form.getHp() > 10)) {
            return "体力上限需在 1 - 10 之间";
        }
        if (form.getSkillName() != null && form.getSkillName().trim().length() > 20) {
            return "武将技名称不超过二十字";
        }
        if (StringUtils.hasText(form.getSkillType()) && !SKILL_TYPES.contains(form.getSkillType().trim())) {
            return "武将技类型只能是：常策 / 奇谋 / 应策 / 秘计";
        }
        if (form.getSkillDesc() != null && form.getSkillDesc().trim().length() > 120) {
            return "武将技描述不超过一百二十字";
        }

        // 同名检查：英雄榜里出现两个「关羽」会让人分不清
        LambdaQueryWrapper<Hero> wrapper = new LambdaQueryWrapper<Hero>().eq(Hero::getName, name);
        if (selfId != null) {
            wrapper.ne(Hero::getId, selfId);
        }
        if (heroMapper.selectCount(wrapper) > 0) {
            return "英雄榜已有名为「" + name + "」的武将";
        }
        return null;
    }

    /** 去空格 + 类型展示名跟随类型 */
    private void normalize(Hero form) {
        form.setName(form.getName().trim());
        form.setEpithet(form.getEpithet() == null ? null : form.getEpithet().trim());
        form.setFaction(form.getFaction().trim());
        form.setType(form.getType().trim());
        form.setTypeName(form.getType());
        if (form.getDescription() != null) {
            form.setDescription(form.getDescription().trim());
        }
        form.setSkillName(trimToNull(form.getSkillName()));
        form.setSkillType(trimToNull(form.getSkillType()));
        form.setSkillDesc(trimToNull(form.getSkillDesc()));
    }

    /** 空串统一存成 null，避免前端判断时要区分 "" 和 null */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LambdaQueryWrapper<Hero> heroQuery(String keyword, String faction, String type) {
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
        return wrapper;
    }

    /* ==================== 军机要务管理 ==================== */

    @GetMapping("/tasks")
    public ApiResult<List<Task>> tasks(@RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Task::getTitle, keyword.trim());
        }
        wrapper.orderByAsc(Task::getSortOrder).orderByAsc(Task::getId);
        return ApiResult.ok(taskMapper.selectList(wrapper));
    }

    @PostMapping("/tasks")
    public ApiResult<Task> createTask(@RequestBody Task form) {
        String error = validateTask(form);
        if (error != null) return ApiResult.fail(error);
        normalizeTask(form);
        if (form.getSortOrder() == null) {
            form.setSortOrder(nextSort(taskMapper.selectCount(null).intValue()));
        }
        taskMapper.insert(form);
        return ApiResult.ok("要务已录入", form);
    }

    @PutMapping("/tasks/{id}")
    public ApiResult<Task> updateTask(@PathVariable Long id, @RequestBody Task form) {
        if (taskMapper.selectById(id) == null) return ApiResult.fail("该要务不存在");
        String error = validateTask(form);
        if (error != null) return ApiResult.fail(error);
        form.setId(id);
        normalizeTask(form);
        taskMapper.updateById(form);
        return ApiResult.ok("要务已更新", taskMapper.selectById(id));
    }

    @DeleteMapping("/tasks/{id}")
    public ApiResult<Void> deleteTask(@PathVariable Long id) {
        if (taskMapper.selectById(id) == null) return ApiResult.fail("该要务不存在");
        taskMapper.deleteById(id);
        return ApiResult.ok("要务已移除", null);
    }

    /* ==================== 烽火快报管理 ==================== */

    @GetMapping("/news")
    public ApiResult<List<News>> news(@RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<News> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(News::getContent, keyword.trim());
        }
        wrapper.orderByAsc(News::getSortOrder).orderByAsc(News::getId);
        return ApiResult.ok(newsMapper.selectList(wrapper));
    }

    @PostMapping("/news")
    public ApiResult<News> createNews(@RequestBody News form) {
        String error = validateNews(form);
        if (error != null) return ApiResult.fail(error);
        normalizeNews(form);
        if (form.getSortOrder() == null) {
            form.setSortOrder(nextSort(newsMapper.selectCount(null).intValue()));
        }
        newsMapper.insert(form);
        return ApiResult.ok("快报已发布", form);
    }

    @PutMapping("/news/{id}")
    public ApiResult<News> updateNews(@PathVariable Long id, @RequestBody News form) {
        if (newsMapper.selectById(id) == null) return ApiResult.fail("该快报不存在");
        String error = validateNews(form);
        if (error != null) return ApiResult.fail(error);
        form.setId(id);
        normalizeNews(form);
        newsMapper.updateById(form);
        return ApiResult.ok("快报已更新", newsMapper.selectById(id));
    }

    @DeleteMapping("/news/{id}")
    public ApiResult<Void> deleteNews(@PathVariable Long id) {
        if (newsMapper.selectById(id) == null) return ApiResult.fail("该快报不存在");
        newsMapper.deleteById(id);
        return ApiResult.ok("快报已移除", null);
    }

    /* ==================== 学识问道题库管理 ==================== */

    @GetMapping("/quiz")
    public ApiResult<List<QuizQuestion>> quiz(@RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<QuizQuestion> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(QuizQuestion::getQuestion, keyword.trim());
        }
        wrapper.orderByAsc(QuizQuestion::getSortOrder).orderByAsc(QuizQuestion::getId);
        return ApiResult.ok(quizQuestionMapper.selectList(wrapper));
    }

    @PostMapping("/quiz")
    public ApiResult<QuizQuestion> createQuiz(@RequestBody QuizQuestion form) {
        String error = validateQuiz(form);
        if (error != null) return ApiResult.fail(error);
        normalizeQuiz(form);
        if (form.getSortOrder() == null) {
            form.setSortOrder(nextSort(quizQuestionMapper.selectCount(null).intValue()));
        }
        quizQuestionMapper.insert(form);
        return ApiResult.ok("题目已录入", form);
    }

    @PutMapping("/quiz/{id}")
    public ApiResult<QuizQuestion> updateQuiz(@PathVariable Long id, @RequestBody QuizQuestion form) {
        if (quizQuestionMapper.selectById(id) == null) return ApiResult.fail("该题目不存在");
        String error = validateQuiz(form);
        if (error != null) return ApiResult.fail(error);
        form.setId(id);
        normalizeQuiz(form);
        quizQuestionMapper.updateById(form);
        return ApiResult.ok("题目已更新", quizQuestionMapper.selectById(id));
    }

    @DeleteMapping("/quiz/{id}")
    public ApiResult<Void> deleteQuiz(@PathVariable Long id) {
        if (quizQuestionMapper.selectById(id) == null) return ApiResult.fail("该题目不存在");
        quizQuestionMapper.deleteById(id);
        return ApiResult.ok("题目已移除", null);
    }

    /* ==================== 将军账号管理 ==================== */

    @GetMapping("/users")
    public ApiResult<List<Map<String, Object>>> users() {
        List<User> users = userMapper.selectList(
                new LambdaQueryWrapper<User>().orderByAsc(User::getId));
        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("faction", u.getFaction());
            m.put("createTime", u.getCreateTime() == null ? "" : u.getCreateTime().format(TIME_FMT));
            m.put("recruited", recruitMapper.selectCount(
                    new LambdaQueryWrapper<Recruit>().eq(Recruit::getUserId, u.getId())));
            result.add(m);
        }
        return ApiResult.ok(result);
    }

    @PostMapping("/users")
    public ApiResult<User> createUser(@RequestBody Map<String, Object> body) {
        String username = body == null ? "" : String.valueOf(body.getOrDefault("username", "")).trim();
        String password = body == null ? "" : String.valueOf(body.getOrDefault("password", ""));
        String faction = body == null ? "han" : String.valueOf(body.getOrDefault("faction", "han"));

        if (username.isEmpty()) return ApiResult.fail("将军名号不可为空");
        if (username.length() > 20) return ApiResult.fail("名号不超过二十字");
        if (!FACTION_NAMES.containsKey(faction)) return ApiResult.fail("请选择有效阵营");
        if (password.length() < 6) return ApiResult.fail("虎符密令至少六位");
        if (userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getUsername, username)) > 0) {
            return ApiResult.fail("此名号已被占用");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setFaction(faction);
        user.setCreateTime(LocalDateTime.now());
        user.setUpdateTime(LocalDateTime.now());
        userMapper.insert(user);
        user.setPassword(null);
        return ApiResult.ok("将军「" + username + "」已入册", user);
    }

    @PutMapping("/users/{id}")
    public ApiResult<User> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User exists = userMapper.selectById(id);
        if (exists == null) return ApiResult.fail("该将军不在册上");

        String username = body == null ? null : String.valueOf(body.getOrDefault("username", exists.getUsername())).trim();
        String faction = body == null ? exists.getFaction() : String.valueOf(body.getOrDefault("faction", exists.getFaction()));
        String password = body == null ? "" : String.valueOf(body.getOrDefault("password", ""));

        if (username.isEmpty()) return ApiResult.fail("将军名号不可为空");
        if (!FACTION_NAMES.containsKey(faction)) return ApiResult.fail("请选择有效阵营");
        if (!username.equals(exists.getUsername())
                && userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getUsername, username)) > 0) {
            return ApiResult.fail("此名号已被占用");
        }
        if (!password.isEmpty() && password.length() < 6) return ApiResult.fail("虎符密令至少六位");

        User patch = new User();
        patch.setId(id);
        patch.setUsername(username);
        patch.setFaction(faction);
        if (!password.isEmpty()) {
            patch.setPassword(passwordEncoder.encode(password));
        }
        userMapper.updateById(patch);
        User updated = userMapper.selectById(id);
        updated.setPassword(null);
        return ApiResult.ok("将军「" + username + "」已更新", updated);
    }

    @DeleteMapping("/users/{id}")
    public ApiResult<Void> deleteUser(@PathVariable Long id) {
        if (userMapper.selectById(id) == null) return ApiResult.fail("该将军不在册上");
        // 清理该账号的招募与抽卡记录，避免残留悬空数据
        recruitMapper.delete(new LambdaQueryWrapper<Recruit>().eq(Recruit::getUserId, id));
        userMapper.deleteById(id);
        return ApiResult.ok("将军已除名", null);
    }

    /* ==================== 内容校验 ==================== */

    private String validateTask(Task form) {
        if (form == null || !StringUtils.hasText(form.getTitle())) return "要务内容不可为空";
        if (form.getTitle().trim().length() > 255) return "要务内容过长";
        return null;
    }

    private void normalizeTask(Task form) {
        form.setTitle(form.getTitle().trim());
        if (form.getCategory() != null) form.setCategory(form.getCategory().trim());
    }

    private String validateNews(News form) {
        if (form == null || !StringUtils.hasText(form.getContent())) return "快报正文不可为空";
        if (form.getContent().trim().length() > 255) return "快报正文过长";
        return null;
    }

    private void normalizeNews(News form) {
        form.setContent(form.getContent().trim());
        if (form.getCategory() != null) form.setCategory(form.getCategory().trim());
    }

    private String validateQuiz(QuizQuestion form) {
        if (form == null || !StringUtils.hasText(form.getQuestion())) return "题目不可为空";
        if (form.getQuestion().trim().length() > 255) return "题目过长";
        for (String opt : new String[]{form.getOptionA(), form.getOptionB(), form.getOptionC(), form.getOptionD()}) {
            if (!StringUtils.hasText(opt)) return "四个选项皆不可为空";
        }
        if (!StringUtils.hasText(form.getAnswer()) || !form.getAnswer().trim().toUpperCase().matches("[ABCD]")) {
            return "正确答案须为 A/B/C/D";
        }
        if (form.getReward() != null && form.getReward() < 0) return "奖励军饷不可为负";
        return null;
    }

    private void normalizeQuiz(QuizQuestion form) {
        form.setQuestion(form.getQuestion().trim());
        form.setOptionA(form.getOptionA().trim());
        form.setOptionB(form.getOptionB().trim());
        form.setOptionC(form.getOptionC().trim());
        form.setOptionD(form.getOptionD().trim());
        form.setAnswer(form.getAnswer().trim().toUpperCase());
        if (form.getExplanation() != null) form.setExplanation(form.getExplanation().trim());
        if (form.getCategory() != null) form.setCategory(form.getCategory().trim());
    }

    /** 下一排序号：现有最大 sort_order + 1 */
    private int nextSort(int count) {
        return count + 1;
    }
}
