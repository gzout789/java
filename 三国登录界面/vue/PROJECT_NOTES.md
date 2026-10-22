# PROJECT_NOTES.md —— 前端项目备忘（给 AI 助手）

> 完整备忘在后端项目：`D:\workSpace\springBootTest\PROJECT_NOTES.md`（必读，含环境踩坑记录）。

## 快速事实

- 前端：Vue 3 + Vite，端口 5173，`vite.config.js` 中 `/api` 代理到 `http://localhost:8081`
- 登录/注册已对接真实后端接口（`src/components/SanguoLogin.vue` 的 `handleLogin` / `handleRegister`）
- 后端：`D:\workSpace\springBootTest`（Spring Boot + MyBatis-Plus + MySQL），桌面 `springBootTest\` 是同步副本
- MySQL：root / 123456，库 `sanguo`，演示账号 **云长 / danfeng123**
- 一键启动：本目录 `一键启动.bat`（GBK）；一键停止：`一键停止.bat`
- 依赖丢失时：`npm install --registry=https://registry.npmmirror.com`
- 电脑会重置：每次开机用户双击 `一键启动.bat` 即可，AI 无需重新搭建任何东西

—— 最后更新：2026-10-09
