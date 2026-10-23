package com.fenglin.springboottest.config;

import com.fenglin.springboottest.entity.Hero;
import com.fenglin.springboottest.entity.News;
import com.fenglin.springboottest.entity.Task;
import com.fenglin.springboottest.entity.User;
import com.fenglin.springboottest.mapper.HeroMapper;
import com.fenglin.springboottest.mapper.NewsMapper;
import com.fenglin.springboottest.mapper.TaskMapper;
import com.fenglin.springboottest.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 演示数据播种：幂等，表里已有数据就跳过。
 * 演示账号：云长 / danfeng123（前端「试看」按钮对应此账号）
 */
@Component
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final UserMapper userMapper;
    private final HeroMapper heroMapper;
    private final TaskMapper taskMapper;
    private final NewsMapper newsMapper;
    private final PasswordEncoder passwordEncoder;

    public DemoDataSeeder(UserMapper userMapper, HeroMapper heroMapper, TaskMapper taskMapper,
                          NewsMapper newsMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.heroMapper = heroMapper;
        this.taskMapper = taskMapper;
        this.newsMapper = newsMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedUsers();
        seedHeroes();
        seedTasks();
        seedNews();
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
