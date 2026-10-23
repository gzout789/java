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
- 页面自检：`.shots\` 下有 2026-10-23 无头 Chrome 自动登录后的各页截图

—— 最后更新：2026-10-23
