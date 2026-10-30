# PROJECT_NOTES.md —— 前端项目备忘（给 AI 助手）

> 完整备忘在 `..\springBootTest\PROJECT_NOTES.md`（必读，含本机环境与踩坑记录）。

## 快速事实

- 前端：Vue 3 + Vite，端口 5173，`vite.config.js` 中 `/api` 代理到 `http://localhost:8081`
- 登录/注册对接真实后端（`src/components/SanguoLogin.vue` 的 `handleLogin` / `handleRegister`）
- 登录成功后后端返回 JWT，存在 `sessionStorage`（`src/composables/useTheme.js`），
  后续请求统一带 `Authorization: Bearer <token>`；后端 401 时自动退回登录页
- 后端：`..\springBootTest\`（Spring Boot + MyBatis-Plus + MySQL），端口 8081
- MySQL：root / 123456，库 `sanguo`，演示账号 **云长 / danfeng123**
- 一键启动：根目录 `..\一键启动.bat`（GBK）；一键停止：`..\一键停止.bat`
- 依赖丢失时：`npm install --registry=https://mirrors.cloud.tencent.com/npm/`
  （本机 `registry.npmmirror.com` 与 npmjs 均不通，只有腾讯镜像通）
- 视图：总览 / 英雄榜 / **点将台（招募）** / 军机要务 / 烽火快报，都在 `SanguoHome.vue` 里，
  导航由 `VIEWS` 数组驱动
- 点将台：`loadRecruit()` 拉 `/api/recruit`，`doRecruit(hero)` 提交 `/api/recruit`；
  军饷、招募价、他阵营加价都由后端算，前端只展示（`gold < cost` 时按钮置灰「军饷不足」）
- 武将立绘（2026-10-30 改）：与后端 `hero.name` 一一对应，两级资源
  - 列表/牌桌用小图：`public/heroes/opt/<武将名>.webp`（768×512，约 55KB，`useHeroImg.js` 的 `heroImg()`）
  - 原图：`public/heroes/<武将名>.png`（1536×1024，约 2MB，仅 `heroFullImg()` 用）
  - **原图不能直接进列表**：26 张共 52MB，会长时间白屏看起来像“武将没有图片”
  - 缺图不再隐藏整块（`display:none` 会让 3:2 占位框空着），改为图片自身 `visibility:hidden`，
    露出底层水墨姓氏占位（`onHeroImgError`），布局不塌
  - 新增画师没有尺寸工具时：`python -c "from PIL import Image; ..."` 生成 opt 目录（需 `pip install pillow`）
- 页面自检：`.shots\` 下有无头浏览器自动登录后的各页截图
  （`admin-*.png` 为 2026-10-23 后台管理系统的截图：登录页 / 控制台 / 新增弹窗 / 亮色主题 / 首页导航入口）

## 后台管理系统（2026-10-23 新增）

- 入口：首页导航栏金色描边的「后台管理系统」按钮（`SanguoHome.vue` 里 `nav-item.nav-admin`），
  点击 `emit('open-admin')` → `App.vue` 把 hash 置为 `#/admin`
- 路由：`App.vue` 监听 hashchange，`#/admin` 渲染后台，其余渲染前台；
  「返回前台」用 `history.replaceState` 抹掉 hash，不产生多余历史记录
- 文件：
  - `src/composables/useAdmin.js` 管理会话（sessionStorage `sg_admin_session`）+ `adminFetch` + hash 常量
  - `src/components/admin/AdminLogin.vue` 管理登录（只有登录，无注册；「填入演示账号」= admin/admin123）
  - `src/components/admin/AdminApp.vue` 控制台：看板（总数/四阵营/平均武力）+ 搜索/阵营/类型筛选 +
    英雄榜表格 + 新增/编辑弹窗 + 删除确认 + toast；支持明暗主题
- 后台账号：**admin / admin123**（独立 `admin_user` 表），接口前缀 `/api/admin`，与前台令牌互不通用
- **大坑**：scoped 样式里写 `:global(html[data-theme='light']) .local` 会被编译器丢弃后半段，
  亮色主题整体失效 —— 两份亮色覆盖都放在组件末尾的**非 scoped** `<style>` 块里，选择器
  手动前缀 `html[data-theme='light'] .admin-app`（`.admin-login` 同理），别改回 scoped 写法

## 烽烟三国杀牌桌布局（2026-10-30 修复「界面会移动」）

牌局里界面抖动/位移全部来自**「父容器尺寸会跟着内容变」**，改动时守住这几条：

1. `.game-root` 固定 `height: 100dvh; overflow: hidden`，布局用
   `grid-template-rows: auto minmax(0,1fr) auto`。以前是 `min-height: 100vh`，
   战报一长/手牌一多就出页面滚动条，滚动条一出现整页左右抖一下。
2. `.board` / `.table` / `.log-panel` / `.lp-body` 都要 `min-height: 0`，
   grid 子项默认 `min-height: auto` 会被内容顶大，`.lp-body` 必须能内部滚动。
3. `.dock` 是固定三段高（提示 20~22 / 操作 52~60 / 手牌 90~104，见末尾断点）。操作按钮每回合
   数量都在变，别让它撑高——撑高一次牌桌就缩一次，座位跟着动。
4. `.hand` 固定 `height: 100%`，横向滚动条用 6px 细条 + 留 padding；
   别用 `min-height` + 自动高度，滚动条出现会多占 15px。
5. **座位用九宫格摆，不要再用绝对定位 + 百分比**：`.table` 是
   `grid-template-columns: auto minmax(0,1fr) auto; grid-template-rows: auto 1fr auto`，
   `.p0` 3/2 居中、`.p1` 2/1、`.p2` 1/1、`.p3` 1/3、`.p4` 2/3，`.center` 在 2/2。
   老写法（p1/p4 `bottom: 27%`）在 1366×768 这类矮屏会让上下两排座位直接压在一起；
   而且 `.p0` 当时用 `transform: translateX(-50%)` 居中，被座位自己的 `:hover` transform
   顶掉，鼠标一移上去就横向跳半个卡宽。网格布局两个问题一起没了。
6. 座位内部各区块**全部固定高度**，任何状态变化都不能改座位高度：
   - `.top`（头像+名号）固定 66 / 矮屏 52；
   - `.equips` 永远占位 17px，只显示两字缩写（装与不装同高）；
   - `.skills` **单行横排**（`flex-wrap: nowrap; height: 17px; overflow: hidden`），
     悬停看完整效果与典故。老写法是垂直列表，3 技能武将（诸葛亮/周瑜等）技能区
     高达 59px、座位总高 213px，在 1440×900 溢出牌桌（2026-10-30 修，
     现最高座位 171px，全部尺寸零裁切零重叠）；
   - `.badge-row` 也 `nowrap + overflow: hidden`，身份/你/已殁组合不变高。
7. `onHandCard()` 里**收兵弃牌的分支必须在响应分支之前**：响应分支以
   「`p.idx === 0` 就 `return`」收尾，写在它后面玩家点手牌永远进不到
   `toggleDiscard`，回合会永久卡在弃牌一步（2026-10-30 修）。
8. 牌桌模板里 `<footer v-if="st.phase === 'playing'">`、`<div v-if="st.phase === 'over'">`
   是**独立 v-if**，不在 `loading / error` 那条链里；首帧 `st` 为 null 会抛
   `Cannot read properties of null (reading 'phase')` 让整个组件白屏，必须写 `st && ...`。
9. 断点一览（改高度先看这里）：`max-height: 820px` 收紧牌桌与底栏、`740px` 再紧一档；
   `max-width: 900px` 时战报挪到牌桌下面。任何改动都要跑一遍
   1920×1080 / 1440×900 / 1366×768 / 1024×700 四个尺寸，确认无座位重叠、无裁切、无页面滚动条。

自检截图：`.shots\game-*.png`（选将 / 牌桌暗色 / 牌桌亮色 / 结算），
`heroes-new-4.jpg` 为 2026-10-30 补的 4 张立绘。

—— 最后更新：2026-10-30（补齐 4 位武将立绘、立绘瘦身、牌桌改网格布局并做矮屏适配、
技能区改单行横排根除高技能武将座位溢出）
