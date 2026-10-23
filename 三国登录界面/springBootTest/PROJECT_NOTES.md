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

## 2026-10-23 第二次启动（当前为 Administrator 本机环境）实测

- 本机与上文记录的 `C:\Users\user` 环境不同，以下为本次实测事实：
  - Java：Zulu **OpenJDK 21.0.10**（`JAVA_HOME=C:\Program Files\Zulu\zulu-21\`）
  - Maven：PATH 无 mvn；IDEA 内置 Maven 在
    `D:\IntelliJ IDEA 2024.3.2.2\plugins\maven\lib\maven3`（classworlds 为 `plexus-classworlds-2.8.0.jar`）
  - **该 maven3 的 bash `mvn` 脚本在本机不可用**（报 `找不到或无法加载主类 ...Launcher`），必须用 java 直调：
    `java -cp "<maven3>\boot\plexus-classworlds-2.8.0.jar" -Dclassworlds.conf=<maven3>\bin\m2.conf -Dmaven.home=<maven3> -Dmaven.multiModuleProjectDirectory=<项目路径> org.codehaus.plexus.classworlds.launcher.Launcher -B -DskipTests package`
  - npm：`registry.npmmirror.com` 本机可通（200），`npm install` 约 35s / 34 包
  - MySQL 8 常驻 3306，`root/123456` 可用，`sanguo` 库首次启动自动建表 + 播种
- 启动顺序：打包（~28s）→ `env -u SERVER__PORT java -jar target\springBootTest-0.0.1-SNAPSHOT.jar --server.port=8081`
  → `cd vue && npm run dev`。两条链路验证均返回 `{"success":true,"message":"点兵入帐成功"}`。

## 后台管理系统（2026-10-23 新增）

**用途**：前台首页导航栏「后台管理系统」按钮 → `#/admin` → 管理登录（**只有登录，没有注册**）→
后台控制台，对首页「英雄榜」做增删改查。

**账号**：`admin / admin123`，存在独立表 `admin_user`（BCrypt 加密），
与前台 `user` 表物理隔离，两边账号互不通用。`DemoDataSeeder.seedAdmin()` 幂等创建（已存在则跳过，不会覆盖改过的密码）。

**令牌隔离**（重要，改动时别破坏）：
- 将军令牌 = 只有 `sub`；管理令牌 = `sub` + `role=admin`
- `AuthInterceptor`（前台 `/api/**`）用 `jwtUtil.parseUserToken()`：带 role 声明的一律 401
- `AdminAuthInterceptor`（`/api/admin/**`）用 `jwtUtil.parseAdminRole()`：无 role 声明一律 401
- `WebConfig` 里前台拦截器 `excludePathPatterns("/api/admin/**")`，后台拦截器只拦 `/api/admin/**` 且排除 `/api/admin/login`

**接口**（除 login 外都要 `Authorization: Bearer <管理令牌>`）：
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | `{username,password}` → `{username,role,remark,lastLogin,token}` |
| GET | `/api/admin/meta` | 看板数据：total / factions[{key,name,count}] / types[{name,count}] / typeOptions / avgPower / topHero |
| GET | `/api/admin/heroes?keyword&faction&type` | 列表，排序 sortOrder→id |
| POST | `/api/admin/heroes` | 新增，body 为 hero 字段；未给 sortOrder 时自动排到末尾 |
| PUT | `/api/admin/heroes/{id}` | 更新（全量字段） |
| DELETE | `/api/admin/heroes/{id}` | 删除；`@Transactional` 同时清理 `recruit` 里的招募记录 |

**校验**（`AdminController.validate`）：姓名 1–20 字且榜内不可重名、阵营四选一、类型必填 ≤10 字、
称号 ≤20 字、小传 ≤200 字、武力/统率 0–100、排序 0–9999。错误以 `ApiResult.fail(中文提示)` 返回，
前端弹窗内直接显示。

**前端文件**：
- `vue/src/composables/useAdmin.js` —— 管理会话（sessionStorage `sg_admin_session`）、`adminFetch`、hash 路由常量
- `vue/src/components/admin/AdminLogin.vue` —— 管理登录页（无注册入口）
- `vue/src/components/admin/AdminApp.vue` —— 控制台：看板 + 表格 + 新增/编辑弹窗 + 删除确认 + toast
- `vue/src/App.vue` —— hash 路由：`#/admin` 走后台，其余走前台；返回前台用 `history.replaceState` 抹 hash
- `vue/src/components/SanguoHome.vue` —— 导航栏新增 `button.nav-admin`，`emit('open-admin')`

**踩坑**：后端 jar 在运行时会被 JVM 锁住，`mvn package` 的 repackage 会报
`Unable to rename '...jar' to '...jar.original'` —— 先停 8081 进程再打包。

—— 最后更新：2026-10-23（新增后台管理系统）
