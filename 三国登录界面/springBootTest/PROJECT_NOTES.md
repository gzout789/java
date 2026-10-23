# PROJECT_NOTES.md —— 给 AI 助手的备忘（重要！先读这个）

> 本文件写给下次开机的 AI 助手（WorkBuddy/CodeBuddy）。
> 最后一次大改：2026-10-23（本机首次运行，后端源码曾缺失，已重建）

## 项目概况

- **项目**：三国主题登录系统（前端 Vue3 + 后端 Spring Boot 3.4.5 + MyBatis-Plus 3.5.9 + MySQL 8）
- **根目录**：`C:\Users\user\IdeaProjects\java\三国登录界面\`
  - 前端：`vue\`（Vite，端口 5173，`/api` 代理到 8081）
  - 后端：`springBootTest\`（端口 8081）
- **数据库**：MySQL 8，服务 MySQL80，`root` / `123456`，库名 `sanguo`
  - 库/表/演示数据全部**自动初始化**：JDBC URL 带 `createDatabaseIfNotExist=true`，
    启动执行 `src/main/resources/schema.sql` 建表，`DemoDataSeeder` 幂等播种
  - 演示账号：`云长 / danfeng123`（登录页「试看」自动填入）
- **接口**（前端已对接好，字段不可改）
  - `POST /api/login` → `{success,message,data:{username,faction,factionName,createTime,token}}`
  - `POST /api/register` → `{success,message}`
  - 以下均需 `Authorization: Bearer <token>`，缺失/过期返回 **401**
  - `GET /api/stats` → `{success,data:{total,byFaction:{han,wei,shu,wu}}}`
  - `GET /api/heroes?keyword&faction&type` → `data: [{id,name,epithet,faction,type,typeName,description,power,leadership}]`
  - `GET /api/heroes/meta` → `{factions:[{key,name}],types:[{name,count,factions:[]}]}`
  - `GET /api/tasks?keyword&category` → `data: [{id,title,done,category}]`
  - `GET /api/news?keyword&category` → `data: [{id,content,category}]`
  - `GET /api/search?keyword` → `{heroes:[],tasks:[],news:[]}`
  - **点将台（2026-10-23 新增）**
    - `GET /api/recruit` → `{success,data:{initialGold,gold,spent,recruitedCount,faction,generals:[{...hero字段, cost, recruited, recruitedAt, sameFaction}]}}`
    - `POST /api/recruit` body `{heroId}` → 成功 `{success:true,message:"X 已入帐下…",data:{gold,cost,hero}}`；失败 `{success:false,message:"军饷不足，尚差 N 石" / "已在将军帐下"}`
    - 规则：初始军饷 8000 石；单价 = 100 + 武力×5 + 统率×5；他阵营再加价 50%（取整到十位）；
      军饷 = 初始 − 已招募花费（不落库，由 `recruit.cost` 汇总得出）；同账号不可重复招募（`uk_user_hero`）

## 启动方式

用户日常：双击根目录 `一键启动.bat`（后端 + 前端 + 健康检查 + 自动开浏览器），
`一键停止.bat` 停止；只启后端用 `springBootTest\启动后端.bat`；改代码后用 `springBootTest\重新打包.bat`。

AI 手动启动（等价）：

1. MySQL 检查：`netstat -ano | findstr :3306`（本机默认已在跑）
2. 后端：`cd springBootTest && java -jar target\springBootTest-0.0.1-SNAPSHOT.jar --server.port=8081`
3. 前端：`cd vue && npm run dev`
4. 验证：`curl --noproxy "*" -X POST http://localhost:8081/api/login -H "Content-Type: application/json" -d "{\"username\":\"\u4e91\u957f\",\"password\":\"danfeng123\"}"`

## 本机环境事实（2026-10-23 实测）

- Java：**Microsoft OpenJDK 17.0.20**（`java -version` 直接可用，`JAVA_HOME` 未设）
- Maven：**PATH 里没有 mvn**。可用的是 IDEA 内置 Maven：
  `C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\plugins\maven-plugin\lib\maven3`
  （另有 `...\IntelliJ IDEA 2024.1.4\plugins\maven\lib\maven3`）
- Maven 仓库：`C:\Users\user\.m2\settings.xml` 已配 **阿里云镜像**（central/npmjs 在本机不通，aliyun 通）
- npm：`npm` 可用（node 22.22.2）；`registry.npmmirror.com` **不通**，用
  `https://mirrors.cloud.tencent.com/npm/` 装依赖
- 无 D 盘；脚本里旧的 `D:\...`、`C:\Users\Administrator\...` 路径已全部改成本机路径
- bat 脚本是 **GBK** 编码，改内容要用 GBK 读写（Python 按 gbk decode/encode），否则中文全乱

## 踩过的坑

- **坑 1｜`cmd //c` 被拦截**：Bash 里执行 cmd 会变成交互式窗口。改用 java 直调 Maven：
  `java -classpath "<maven3>\boot\plexus-classworlds-2.11.0.jar" "-Dclassworlds.conf=<maven3>\bin\m2.conf" "-Dmaven.home=<maven3>" "-Dmaven.multiModuleProjectDirectory=<项目路径>" org.codehaus.plexus.classworlds.launcher.Launcher -B -DskipTests clean package`
- **坑 2｜环境变量 `SERVER__PORT`**：Bash 沙箱里存在该变量，relaxed binding 会覆盖 `server.port`。
  启动前用 `env -u SERVER__PORT -u SERVER__HOST`，或显式 `--server.port=8081`
- **坑 3｜curl 必须 `--noproxy "*"`**，否则 localhost 请求被代理拦截
- **坑 4｜curl 发中文 body**：Bash 里中文可能是 GBK 字节，Spring 按 UTF-8 解析会 400
  （`Invalid UTF-8 middle byte`）。用 `\u4e91\u957f` 这样的 JSON 转义，或把 body 写进 UTF-8 文件并用**相对路径** `--data-binary @file`
- **坑 5｜文件路径带中文**：Windows 版 curl 用绝对 `/tmp/...` 路径读不到文件，导致空 body（400 Required request body is missing）
- **坑 6｜Bash 工具每条命令都打印 `dirname: command not found` 警告**，不影响执行；命令前置
  `export PATH="/c/Program Files/Git/usr/bin:/c/Windows/System32:/c/Windows:$PATH"` 即可用 ls/grep/find
- **坑 7｜后台常驻**：用 Bash 工具的 `run_in_background`，`(... &)` 会被沙箱回收

## 2026-10-23 重建说明（后端源码曾整体缺失）

本目录的 `springBootTest` 当时只有 pom、sql、bat、备忘，**没有 `src`**，8081 起不来。
已按前端实际调用重建后端（包名 `com.fenglin.springboottest`，13 个文件）：

```
src/main/java/com/fenglin/springboottest/
├── SpringBootTestApplication.java        # 启动类 + @MapperScan
├── common/ApiResult.java                 # {success,message,data}
├── config/PasswordEncoderConfig.java     # BCrypt
├── config/WebConfig.java                 # 拦截器 + CORS
├── config/DemoDataSeeder.java            # 幂等播种：5 账号 / 22 武将 / 8 要务 / 8 快报
├── controller/ApiUserController.java     # /api/login /api/register /api/stats
├── controller/ContentController.java     # /api/heroes /api/heroes/meta /api/tasks /api/news /api/search
├── controller/RecruitController.java     # /api/recruit（GET 点将台总览 / POST 招募）
├── dto/LoginRequest.java, RegisterRequest.java, LoginUserVO.java, RecruitRequest.java, RecruitGeneralVO.java
├── entity/User.java, Hero.java, Task.java, News.java, Recruit.java
├── mapper/UserMapper.java, HeroMapper.java, TaskMapper.java, NewsMapper.java, RecruitMapper.java
├── security/JwtUtil.java                 # jjwt 0.12.6，HS384，12 小时
├── security/AuthInterceptor.java         # Bearer 校验，失败 401
└── service/UserService.java + impl/UserServiceImpl.java
    service/RecruitService.java + impl/RecruitServiceImpl.java   # 军饷 / 价格 / 去重
src/main/resources/
├── application.properties                # 8081 / 数据源 / sql.init / JWT 密钥
└── schema.sql                            # 幂等建表（user/hero/task/news/recruit）
```

验证结果（2026-10-23）：登录、注册、stats、heroes(+meta)、tasks、news、search 全部 200；
无 token 访问返回 401；前端代理链路通过；无头 Chrome 自动登录截图正常（截图在 `vue\.shots\`）。

—— 最后更新：2026-10-23
