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
- 武将立绘：`public/heroes/<武将名>.png`，与后端 `hero.name` 一一对应，缺图会自动隐藏
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

—— 最后更新：2026-10-23（新增后台管理系统）
