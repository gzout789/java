# 三国主题登录界面 · Vue 工程

基于 **Vue 3 + Vite** 的三国（汉风）主题登录界面。水墨山水背景、朱红描金配色，支持阵营主题切换。

## 功能特性

- 水墨山水 SVG 背景 + 飘动云雾动画（零图片依赖，离线可用）
- **登录 / 注册 同屏切换**：卡片顶部「登录 / 注册」标签页，注册含「再验密令」与一致性校验
- 阵营主题一键切换：**汉 / 魏 / 蜀 / 吴**（主色调随之变化，注册时即选定阵营）
- 「铭记吾名」记住账号（`localStorage` 持久化）
- 密码显示 / 隐藏切换
- 登录加载态 + 毛笔风 toast 提示
- 响应式布局，适配窄屏

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173，自动打开浏览器）
npm run dev

# 构建生产包到 dist/
npm run build

# 本地预览构建产物
npm run preview
```

## 一键启动（Windows）

项目根目录提供了 **`启动.bat`**，双击即可：检测 Node 环境 → 首次自动安装依赖 → 启动开发服务器并自动打开浏览器。

- 桌面另有一份 **`三国登录界面-启动.bat`**（内容相同，已写死项目路径），放在桌面上双击也能直接启动。
- 关闭启动后弹出的黑色窗口即可停止服务。
- 服务器地址：`http://localhost:5173/`

## 目录结构

```
三国登录界面/
├── index.html              # Vite 入口
├── package.json
├── vite.config.js
├── 启动.bat                # Windows 一键启动脚本（双击运行）
├── src/
│   ├── main.js
│   ├── App.vue
│   └── components/
│       └── SanguoLogin.vue  # 登录界面组件
└── login-standalone.html   # 旧版纯 HTML（无构建）备份
```

## 接入真实登录接口

在 `src/components/SanguoLogin.vue` 的 `handleLogin` 方法中，将演示用的
`setTimeout` 替换为实际的登录请求（如 `fetch` / `axios`）即可。
