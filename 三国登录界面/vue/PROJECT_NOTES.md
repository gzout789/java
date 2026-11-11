# PROJECT_NOTES.md —— 前端项目备忘（给 AI 助手）

> 完整备忘在 `..\springBootTest\PROJECT_NOTES.md`（必读，含本机环境与踩坑记录）。

## 引擎代码结构（2026-11-02 拆分 engine.js）

原 1476 行的 `src/game/engine.js` 已按职责拆分，主文件现在只留「类骨架 + 开局主流程」：

```
src/game/
├── engine.js           # Game 类骨架 + prepare/start/loop/nextTurn/runTurn/judgePhase/judgeSwap/discardPhase
├── engine/
│   ├── deck.js         # 牌堆 drawRaw/drawCards/dropCard/removeHand
│   ├── combat.js       # 出牌战斗 useCard/equipCard/resolveSlash/askDodge/resolveSteal/resolveDuel/askNegate 等
│   ├── damage.js       # 伤害/濒死/阵亡/胜负 damage/dying/death/checkWin
│   ├── skills.js       # 技能 hasEffect/skillOf/canBeSlash/useSkill/useSecretSkill
│   └── distance.js     # 距离 + 交互 + 杂项 distance/attackReach/slashTargets/waitHuman/submit/log 等
```

合并方式：主文件末尾 `Object.assign(Game.prototype, xxxMethods)`，方法调用方式（`this.xxx`）
与实例状态（`this.state`）**完全不变**，是纯组织性重构。改引擎时按职责定位到对应子模块即可。

## 快速事实

- 前端：Vue 3 + Vite，端口 5173，`vite.config.js` 中 `/api` 代理到 `http://127.0.0.1:8081`
  （2026-11-11 由失效的 `192.168.55.1` 改来，别再写回旧局域网 IP）
- 登录/注册对接真实后端（`src/components/SanguoLogin.vue` 的 `handleLogin` / `handleRegister`）
- 登录成功后后端返回 JWT，存在 `sessionStorage`（`src/composables/useTheme.js`），
  后续请求统一带 `Authorization: Bearer <token>`；后端 401 时自动退回登录页
- 后端：`..\springBootTest\`（Spring Boot + MyBatis-Plus + MySQL），端口 8081
- MySQL：root / 123456，库 `sanguo`，演示账号 **云长 / danfeng123**
- 一键启动：根目录 `..\一键启动.bat`（GBK）；一键停止：`..\一键停止.bat`
- 依赖丢失时：`npm install --registry=https://mirrors.cloud.tencent.com/npm/`
  （本机 `registry.npmmirror.com` 与 npmjs 均不通，只有腾讯镜像通）
- 视图：总览 / 武将图鉴 / 招募抽卡 / 学识问道（研读史册） / **考校学识** / 军机要务 /
  烽火快报，都在 `SanguoHome.vue` 里，导航由 `VIEWS` 数组驱动
  （2026-11-11：「考校学识」从学识问道页内的子区块独立成一级视图，
  答题区拆为 `components/StudyQuiz.vue`；题库状态仍由 `SanguoHome.vue` 持有，
  通过 props 传入、`@choose` / `@submit` / `@go-study` 回传）
- 点将台：`loadRecruit()` 拉 `/api/recruit`，`doRecruit(hero)` 提交 `/api/recruit`；
  军饷、招募价、他阵营加价都由后端算，前端只展示（`gold < cost` 时按钮置灰「军饷不足」）
- 武将立绘（2026-10-30 改，2026-11-02 再优化）：与后端 `hero.name` 一一对应，两级资源
  - 列表/牌桌用小图：`public/heroes/opt/<武将名>.webp`（768×512，约 55KB，`useHeroImg.js` 的 `heroImg()`）
  - 原图：`public/heroes/<武将名>.webp`（1536×1024，2026-11-02 起由 PNG 压缩为 webp，约 150-330KB，
    仅 `heroFullImg()` 用，该函数目前零调用）
  - **原图不能直接进列表**：以前 26 张共 52MB 会长时间白屏；现已压缩，`public/heroes` 共 6.7MB
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
  - `src/components/admin/AdminLogin.vue` 管理登录（只有登录，无注册；已移除「填入演示账号」试看入口与演示提示）
  - `src/components/admin/AdminApp.vue` 控制台：看板（总数/四阵营/平均武力）+ 搜索/阵营/类型筛选 +
    英雄榜表格 + 新增/编辑弹窗 + 删除确认 + toast；支持明暗主题
- 后台账号：**全局仅一个**，用户名 `管理员`，密码由部署者自行保管（独立 `admin_user` 表）；接口前缀 `/api/admin`，与前台令牌互不通用
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

## 烽烟三国杀「出牌无法指定目标 / 卡死」（2026-11-11 修复）

现象：选牌后点高亮座位没反应，或点着点着回合莫名进了弃牌，界面像冻住。
**根因三个独立问题叠在一起，都在引擎侧，不是 UI 按钮没绑事件**，排查时别在
`GameSeat.vue` 的 `@click` 上白费时间：

1. **Vue `reactive(Map)` 身份陷阱**
   `SanguoGame.vue` 里 `game.value = createGame(...)`，`Game` 实例被 `ref` 包成响应式代理，
   连带 `this._waiters` 这个普通 `Map` 也变成代理。`waitHuman()` 旧代码靠
   `slots.get(channel) === w` 判断并删除等待槽，代理下 `get()` 返回的是代理对象，
   比较恒为 `false` → 槽永远删不掉 → `hasWaiter()` 恒真 → 看门狗每 25s 误报一次停滞，
   `_waiters` 一路泄漏（诊断脚本实测三局残留 3/2/3）。
   修法：`engine.js` 里 `this._waiters = markRaw(new Map())`、
   `this._pendingQueue = markRaw([])`；`distance.js` 的 `waitHuman()` 改成
   **每 channel 一个 FIFO 队列**，删除时用 `w.queue.indexOf(w)` 定位，不再做对象身份比较。

2. **看门狗 / 30s 超时把玩家「用兵」阶段强杀了**（这是「无法指定目标」的直接原因）
   旧 `waitHuman('play')` 也带 30s 超时，看门狗 25s 一到就 `resolveWait(null)`
   把 `'play'` 结算掉，回合偷偷推进到 `discard`；但 `selecting` 是组件本地状态，
   仍显示高亮座位，此时点座位已没有合法回合上下文 → 看起来就是「点了没用 + 卡死」。
   修法：`'play'` 通道不设超时；看门狗遇到 `hasWaiter('play')` 只重置
   `_lastProgress` 并 `return`，绝不结算等待。静置 27s 实测 `stage` 始终停在 `play`。

3. **多条 fire-and-forget 异步链互相清空 `state.pending`**
   出牌是「发射后不管」的异步链，响应询问可能与主循环询问并存；旧代码链尾直接
   `this.state.pending = null`，会抹掉另一条链刚弹出的询问，玩家看不到按钮但链还在等。
   修法：`distance.js` 新增 `pushPending() / clearPending(token) / clearAllPending()`
   token 队列，`engine.js` / `combat.js` / `damage.js` 所有玩家询问点统一改成
   ```js
   const tok = this.pushPending({ ... })
   const action = await this.waitHuman()
   this.clearPending(tok)
   ```
   胜负结算与 `destroy()` 调 `clearAllPending()`。UI 侧配套：`watch(pending)` 清掉
   `selecting / selectedUid / skillMenu`，`onSeatClick` 加「响应优先 + 回合守卫」
   （`myTurn && st.stage === 'play'`），footer 给选目标态一个「取消选目标」入口，
   出牌统一走 `fireUseCard()` 兜住 Promise rejection。

**改引擎交互后必跑这三项验收，别只靠肉眼看牌桌**：
- `node game-smoke.mjs`：3/3 局完整打完（本次结果 `SMOKE_EXIT=0`）
- 临时诊断脚本复现选牌→选目标链路：`_waiters` 全程 0 泄漏、多目标分支真的被触发
- 静置 27s：玩家回合不被强推（`结论: 玩家回合被强制结束 = false`）
- 收尾 `npm run build`（本次 `41 modules transformed` / `EXIT=0`）

## 「考校学识」独立成一级视图（2026-11-11）

- 原来：答题得军饷那一块（题库 / 选项 / 提交 / 正解解析）和「📖 研读史册」的 4 张
  静态学习卡挤在 `activeView === 'study'` 同一个 `<section>` 里。
- 现在：`VIEWS` 新增 `{ key: 'quiz', label: '考校学识' }`，成为顶部导航独立一项；
  `study` 视图只留研读史册 + 底部「前往考校学识」引导；两个视图互相有入口，
  总览的 `study-entry` 卡片也拆成「研读史册」「考校学识 · 答题赚军饷」两个按钮。
- 组件：`src/components/StudyQuiz.vue`。**题库状态与提交逻辑仍留在 `SanguoHome.vue`**
  （`quiz` / `quizFeedback` / `submitAnswer` / `chooseOption`），组件只负责渲染，
  通过 props 收数据、`@choose` / `@submit` / `@go-study` 回传动作 —— 保持单一数据源，
  总览页的 `quizAnswered` / `quizEarned` / `quizQuestions.length` 统计一行都不用改。
- **坑：`SanguoHome.vue` 是 `<style scoped>`**，组件内部 DOM 带的是自己的
  `data-v-*` 属性，父组件的 `.quiz-*` 规则一条都继承不到。所以 `.quiz-list` 到
  `.quiz-done` 整段 CSS 必须**连同样式一起搬进 `StudyQuiz.vue`**，不能只在父组件留着。
  好处是主题色全走 `global.css` 的 CSS 变量（`--gold` / `--surface-2` 等），
  明暗主题无需额外覆盖；`.ink-ripple-host` 也是全局的，水墨波纹照常生效。
- 答题失败提示原先用招募页的 `recruitMsg`（`flashRecruitMsg`），玩家留在答题页时
  根本看不到，表现得像点了没反应。现改为独立的 `quizMsg` + `flashQuizMsg`，在本视图内显示。
- 收尾跑 `npm run build`（本次 43 modules / `EXIT=0`）。

## 「考校学识」改为一题一屏闯关（2026-11-11 再改）

用户否决了「一页列出全部题目 + 逐题点呈交答卷」的列表式，改成一次只出一题：
选 → 呈交答卷 → 立即显示对错 / 正解 / 解析 → 「下一题」；顶部进度条 + 第 X/N 题，
答完进总结页（本轮答对 / 题数 / 军饷），可「再考一轮」；全答对显示「群题尽破」，
可「温习全部题目（不计赏）」。答错给「再答一次」（后端答错不落库，可反复试）。

**关键设计（改答题流程前务必先读）**：
- `StudyQuiz.vue` 内 `deck` 是题库的**一次性浅拷贝快照**，选中态 `q.picked`、
  `index` / `stage` / `results` 全在组件内。原因：父组件 `submitAnswer` 成功后会
  `await loadQuiz()` 刷新 `questions`，若直接渲染 `props.questions`，当前题对象会被
  换掉、选中态与进度全丢。**绝不要改回直接用 props.questions 渲染。**
- 父组件只管网络：`submitAnswer(q, choice)`，组件 `emit('submit', q, q.picked)`
  把选项一并回传；`pickedOf` / `chooseOption` / `optionClass` 已全删，
  `defineEmits` 只剩 `submit` / `go-study`。
- 后端语义（`QuizServiceImpl`）：`board()` 的 `answered` **只在答对时为 true**，
  答错不写 `quiz_earning`、可重答；`answer()` 对已答对题返回 `repeat: true, reward: 0`。
  所以闯关队列默认只收 `!answered` 的题；`buildDeck()` 还用本地 `results` 里已答对的
  id 再排除一次，防止 `loadQuiz()` 没刷新完就点「再考一轮」把刚答对的题排回来。
- 反馈显示用组件内 `shown` 快照（watch `props.feedback` 复制），不直接渲染
  `props.feedback`，避免切视图重建后残留反馈串到新题。
- `stage` 四态：`answering | feedback | summary | cleared`；进度在 feedback/summary
  时按 `index + 1` 算，最后一题提交后即 100%。

验收：`npm run build` 43 modules / `EXIT=0`；另做状态机自检
（选 → 提交 → 反馈 → 重答 → 下一题 → 总结 → 再考一轮 → 通关 → 温习）
**29/29 断言通过**。以后改答题流程，先跑状态机断言再 build。

—— 最后更新：2026-11-11（考校学识改为一题一屏闯关；此前同日已独立成一级视图并抽出
`StudyQuiz.vue`；另修复烽烟三国杀出牌卡死：markRaw 等待槽 + FIFO 队列、
`'play'` 免超时与看门狗放行、pending token 队列；`/api` 代理改回 127.0.0.1）
上次：2026-10-30（补齐 4 位武将立绘、立绘瘦身、牌桌改网格布局并做矮屏适配、
技能区改单行横排根除高技能武将座位溢出）
