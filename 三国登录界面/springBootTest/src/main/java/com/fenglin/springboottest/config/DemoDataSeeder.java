package com.fenglin.springboottest.config;

import com.fenglin.springboottest.entity.AdminUser;
import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.News;
import com.fenglin.springboottest.entity.Task;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.AdminUserMapper;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.NewsMapper;
import com.fenglin.springboottest.mapper.TaskMapper;
import com.fenglin.springboottest.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 演示数据播种：幂等，表里已有数据就跳过。
 * 演示账号：云长 / danfeng123（前端「试看」按钮对应此账号）
 */
@Component
@Order(2) // 排在 SchemaMigrator 之后，保证新字段已就位
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final HeroMapper heroMapper;
    private final TaskMapper taskMapper;
    private final NewsMapper newsMapper;
    private final PasswordEncoder passwordEncoder;

    public DemoDataSeeder(UserMapper userMapper, AdminUserMapper adminUserMapper, HeroMapper heroMapper,
                          TaskMapper taskMapper, NewsMapper newsMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.heroMapper = heroMapper;
        this.taskMapper = taskMapper;
        this.newsMapper = newsMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedAdmin();
        seedUsers();
        seedHeroes();
        enrichHeroSkills();
        seedTasks();
        seedNews();
    }

    /**
     * 烽烟三国杀的武将技与体力表。
     * 效果实现在前端 src/game/rules.js 的 HERO_SKILLS（按武将姓名匹配 effect），
     * 这里存的是展示用的文案，后台管理系统可以直接改。
     */
    private static final Map<String, String[]> HERO_SKILLS = new LinkedHashMap<>();

    static {
        HERO_SKILLS.put("曹操", new String[]{"4", "挟主", "奇谋", "出牌阶段，弃一张手牌，命一名其他角色交出一张手牌"});
        HERO_SKILLS.put("夏侯惇", new String[]{"4", "刚烈", "应策", "你受到创伤后，可对伤害来源造成 1 点创伤"});
        HERO_SKILLS.put("张辽", new String[]{"4", "威震", "奇谋", "出牌阶段，弃一张手牌，令一名角色弃置一张手牌"});
        HERO_SKILLS.put("许褚", new String[]{"4", "裸衣", "奇谋", "弃一张手牌，本回合你的【击】创伤 +1"});
        HERO_SKILLS.put("司马懿", new String[]{"3", "反馈", "应策", "你受到创伤后，可获得伤害来源的一张手牌"});
        HERO_SKILLS.put("郭嘉", new String[]{"3", "遗计", "应策", "你受到创伤后，可摸两张牌"});
        HERO_SKILLS.put("关羽", new String[]{"4", "武圣", "应策", "你可将任意一张手牌当作【击】使用"});
        HERO_SKILLS.put("张飞", new String[]{"4", "咆哮", "奇谋", "出牌阶段，你可额外使用一张【击】"});
        HERO_SKILLS.put("赵云", new String[]{"4", "龙胆", "应策", "你可将【挡】当【击】、【击】当【挡】使用"});
        HERO_SKILLS.put("马超", new String[]{"4", "铁骑", "常策", "你计算攻击距离时无视目标的坚驹"});
        HERO_SKILLS.put("黄忠", new String[]{"4", "烈弓", "常策", "你的攻击距离 +1"});
        HERO_SKILLS.put("诸葛亮", new String[]{"3", "空城", "常策", "你没有手牌时，不能被【击】与【探囊】指定"});
        HERO_SKILLS.put("周瑜", new String[]{"3", "英姿", "奇谋", "出牌阶段，你可摸一张牌（每回合限一次）"});
        HERO_SKILLS.put("吕蒙", new String[]{"4", "克己", "常策", "若本回合未使用过【击】，收兵阶段不必弃牌"});
        HERO_SKILLS.put("陆逊", new String[]{"3", "谦逊", "常策", "你不能成为【探囊】与【困局】的目标"});
        HERO_SKILLS.put("甘宁", new String[]{"4", "奇袭", "奇谋", "你可将一张黑色手牌当作【探囊】使用"});
        HERO_SKILLS.put("太史慈", new String[]{"4", "神射", "应策", "你的【击】造成创伤后，你摸一张牌"});
        HERO_SKILLS.put("孙权", new String[]{"4", "制衡", "奇谋", "弃置任意数量手牌，再摸等量的牌（每回合限一次）"});
        HERO_SKILLS.put("吕布", new String[]{"5", "无双", "应策", "你的【击】需两张【挡】才能抵消"});
        HERO_SKILLS.put("董卓", new String[]{"5", "暴虐", "应策", "你受到创伤后，摸一张牌"});
        HERO_SKILLS.put("袁绍", new String[]{"4", "乱击", "秘计", "一局一次：弃两张手牌，对场上其他角色各造成 1 点创伤"});
        HERO_SKILLS.put("公孙瓒", new String[]{"4", "白马", "常策", "你计算与其他角色的距离 -1"});
    }

    /** 给还没有武将技的武将补上体力与技能（老库升级、新库播种都走这里） */
    private void enrichHeroSkills() {
        List<Hero> heroes = heroMapper.selectList(null);
        int filled = 0;
        for (Hero hero : heroes) {
            if (hero.getName() == null) {
                continue;
            }
            String[] skill = HERO_SKILLS.get(hero.getName());
            if (skill == null) {
                continue;
            }
            Hero patch = new Hero();
            patch.setId(hero.getId());
            boolean dirty = false;
            if (hero.getHp() == null) {
                patch.setHp(Integer.valueOf(skill[0]));
                dirty = true;
            }
            if (hero.getSkillName() == null || hero.getSkillName().isEmpty()) {
                patch.setSkillName(skill[1]);
                patch.setSkillType(skill[2]);
                patch.setSkillDesc(skill[3]);
                dirty = true;
            }
            if (dirty) {
                heroMapper.updateById(patch);
                filled++;
            }
        }
        if (filled > 0) {
            log.info("已为 {} 位武将补入体力与武将技", filled);
        }
    }

    /** 后台管理账号：admin / admin123（只建一次，改过密码不会被覆盖） */
    private void seedAdmin() {
        if (adminUserMapper.selectCount(null) > 0) {
            return;
        }
        AdminUser admin = new AdminUser();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setRole("admin");
        admin.setRemark("内置管理员");
        admin.setCreateTime(LocalDateTime.now());
        adminUserMapper.insert(admin);
        log.info("已创建后台管理账号：admin / admin123");
    }

    private void seedUsers() {
        if (userMapper.selectCount(null) > 0) {
            return;
        }
        String[][] demo = {
                {"云长", "shu"},
                {"翼德", "shu"},
                {"子龙", "shu"},
                {"孟德", "wei"},
                {"仲谋", "wu"}
        };
        LocalDateTime now = LocalDateTime.now();
        for (String[] row : demo) {
            User user = new User();
            user.setUsername(row[0]);
            user.setPassword(passwordEncoder.encode("danfeng123"));
            user.setFaction(row[1]);
            user.setCreateTime(now);
            user.setUpdateTime(now);
            userMapper.insert(user);
        }
        log.info("已播种 {} 个演示账号（演示账号：云长 / danfeng123）", demo.length);
    }

    private void seedHeroes() {
        if (heroMapper.selectCount(null) > 0) {
            return;
        }
        // 名号, 称号, 阵营, 类型, 武力, 统率, 小传
        String[][] data = {
                {"曹操", "乱世奸雄", "wei", "君主", "72", "96", "挟天子以令诸侯，横槊赋诗，气吞山河。"},
                {"夏侯惇", "独眼苍狼", "wei", "猛将", "88", "82", "拔矢啖睛，性烈如火，曹营第一先锋。"},
                {"张辽", "威震逍遥", "wei", "统帅", "92", "95", "八百破十万，威震逍遥津，江东小儿不敢夜啼。"},
                {"许褚", "虎痴", "wei", "猛将", "96", "68", "力能倒拖牛尾，裸衣斗马超，护卫中军不离半步。"},
                {"司马懿", "冢虎", "wei", "军师", "63", "98", "鹰视狼顾，能忍者胜，终成三家归晋之基。"},
                {"郭嘉", "鬼才", "wei", "军师", "45", "88", "算无遗策，十胜十败定北疆，惜天不假年。"},
                {"关羽", "武圣", "shu", "猛将", "97", "95", "温酒斩华雄，过五关斩六将，义薄云天。"},
                {"张飞", "万人敌", "shu", "猛将", "98", "85", "当阳桥头一声断喝，独退曹家百万兵。"},
                {"赵云", "常山虎将", "shu", "猛将", "96", "91", "长坂坡七进七出，一身是胆，护主周全。"},
                {"马超", "锦马超", "shu", "猛将", "97", "88", "西凉铁骑之子，杀得曹操割须弃袍。"},
                {"黄忠", "老当益壮", "shu", "猛将", "93", "86", "定军山一箭斩夏侯，年近七旬仍开三石之弓。"},
                {"诸葛亮", "卧龙", "shu", "军师", "38", "95", "未出茅庐已知三分天下，鞠躬尽瘁死而后已。"},
                {"周瑜", "美周郎", "wu", "军师", "71", "93", "赤壁一把火，烧尽曹军八十万，雄姿英发。"},
                {"吕蒙", "吴下阿蒙", "wu", "统帅", "78", "91", "士别三日刮目相看，白衣渡江取荆州。"},
                {"陆逊", "江东儒将", "wu", "军师", "60", "94", "火烧连营七百里，书生亦可破枭雄。"},
                {"甘宁", "锦帆贼", "wu", "猛将", "94", "79", "百骑劫魏营，铃响处无人敢挡。"},
                {"太史慈", "神射", "wu", "猛将", "92", "83", "猿臂善射，箭无虚发，北海突围救孔融。"},
                {"孙权", "碧眼儿", "wu", "君主", "66", "89", "坐断东南战未休，生子当如孙仲谋。"},
                {"吕布", "飞将", "han", "猛将", "100", "87", "人中吕布，马中赤兔，方天画戟无人可挡。"},
                {"董卓", "西凉狼", "han", "君主", "87", "84", "废立天子，焚毁洛阳，暴虐终致身死灯灭。"},
                {"袁绍", "四世三公", "han", "君主", "68", "86", "门生故吏遍天下，可惜好谋无断。"},
                {"公孙瓒", "白马将军", "han", "统帅", "84", "88", "白马义从踏塞北，声名远震乌桓。"}
        };
        int sort = 1;
        for (String[] row : data) {
            Hero hero = new Hero();
            hero.setName(row[0]);
            hero.setEpithet(row[1]);
            hero.setFaction(row[2]);
            hero.setType(row[3]);
            hero.setTypeName(row[3]);
            hero.setPower(Integer.valueOf(row[4]));
            hero.setLeadership(Integer.valueOf(row[5]));
            hero.setDescription(row[6]);
            hero.setSortOrder(sort++);
            heroMapper.insert(hero);
        }
        log.info("已播种英雄榜 {} 位武将", data.length);
    }

    private void seedTasks() {
        if (taskMapper.selectCount(null) > 0) {
            return;
        }
        String[][] data = {
                {"卯时点卯，清点中军帐下人马", "true", "军务"},
                {"校场操演枪阵，验收新募士卒", "false", "军务"},
                {"押运粮草三十车至前线大营", "false", "军务"},
                {"探马回报曹军动向，重绘行军图", "false", "军务"},
                {"修缮城防，补筑北门箭楼", "false", "内政"},
                {"核计本月军饷钱粮，造册上报", "true", "内政"},
                {"犒赏三军，设宴安抚新降之将", "false", "内政"},
                {"遣使赴江东，商议互市通商", "false", "外交"}
        };
        int sort = 1;
        for (String[] row : data) {
            Task task = new Task();
            task.setTitle(row[0]);
            task.setDone(Boolean.valueOf(row[1]));
            task.setCategory(row[2]);
            task.setSortOrder(sort++);
            taskMapper.insert(task);
        }
        log.info("已播种军机要务 {} 条", data.length);
    }

    private void seedNews() {
        if (newsMapper.selectCount(null) > 0) {
            return;
        }
        String[][] data = {
                {"江北探马回报：曹军辎重营西移三十里，似有退兵之意。", "军情"},
                {"江东水师新造艨艟二十艘，已入濡须口。", "军情"},
                {"斥候于山谷间发现不明营火，疑为敌军前锋。", "军情"},
                {"朝廷下诏加封各路诸侯，使者已至许都。", "朝野"},
                {"西凉马腾遣使入京，贡良马百匹。", "朝野"},
                {"蜀中米价回落三成，百姓争相入市。", "朝野"},
                {"夜观天象，紫微星旁有客星犯位，太史令称主兵事。", "异象"},
                {"汉水暴涨，渡口浮桥被冲断，两岸商旅滞留。", "异象"}
        };
        int sort = 1;
        for (String[] row : data) {
            News news = new News();
            news.setContent(row[0]);
            news.setCategory(row[1]);
            news.setSortOrder(sort++);
            newsMapper.insert(news);
        }
        log.info("已播种烽火快报 {} 则", data.length);
    }
}
