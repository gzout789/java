/**
 * 距离计算、目标筛选、玩家交互通道、日志等杂项（Game 的方法 mixin）
 */
import { markRaw } from 'vue'
import { EQUIPS } from '../rules.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const distanceMethods = {
  distance(a, b) {
    const n = this.state.seats.length
    let d = Math.min(Math.abs(a.idx - b.idx), n - Math.abs(a.idx - b.idx))
    if (d === 0) d = 1
    if (a.equip.minusHorse) d -= 1
    if (this.hasEffect(a, 'dist_minus')) d -= 1
    if (b.equip.plusHorse) {
      d += 1
      if (this.hasEffect(a, 'reach_ignore')) d -= 1 // 铁骑无视坚驹
    }
    return Math.max(1, d)
  },

  attackReach(a) {
    let reach = 1
    if (a.equip.weapon) {
      const def = EQUIPS[a.equip.weapon.key]
      if (def && def.reach) reach = def.reach
    }
    if (this.hasEffect(a, 'reach_plus')) reach += 1
    return reach
  },

  inReach(a, b) {
    return this.distance(a, b) <= this.attackReach(a)
  },

  /** 可作为【击】目标的人 */
  slashTargets(seat) {
    return this.state.seats.filter(
      (t) => t.alive && t.idx !== seat.idx && this.inReach(seat, t) && !this.kongCheng(t)
    )
  },

  /** 可作为【探囊】/延时计略目标的人 */
  schemeTargets(seat, key) {
    return this.state.seats.filter((t) => {
      if (!t.alive || t.idx === seat.idx) return false
      if (key === 'steal') {
        if (this.distance(seat, t) > 1) return false
        if (this.hasEffect(t, 'immune_steal')) return false
        if (this.kongCheng(t)) return false
      }
      if (key === 'trapSlash' && this.hasEffect(t, 'immune_steal')) return false
      if (key === 'duel' && this.hasEffect(t, 'immune_duel')) return false
      return true
    })
  },

  kongCheng(seat) {
    return this.hasEffect(seat, 'kongcheng') && seat.hand.length === 0
  },

  nextSeat(seat) {
    const n = this.state.seats.length
    for (let i = 1; i <= n; i++) {
      const cand = this.state.seats[(seat.idx + i) % n]
      if (cand.alive) return cand
    }
    return null
  },

  /* ==================== 玩家交互通道 ====================
   * 出牌是 UI 触发的「发射后不管」异步链（SanguoGame.vue 里 useCard 不 await），
   * 它会和主循环的等待同时存在：例如玩家自己用兵时一记【击】把 AI 打濒死，
   * 「是否出【援】相救」在出牌链里弹出，而主循环此刻还在等「收兵」。
   *
   * 按用途分槽，互不覆盖：
   *   'play'     主循环等「收兵」（玩家正常出牌阶段，不设超时）
   *   'discard'  收兵阶段等「确定弃牌」
   *   'response' 各类响应询问（挡 / 救 / 缓策 / 改判 / 惑敌）
   * 每槽是 FIFO 队列而非单个等待者：同槽并发时排队结算，不会互相顶掉。
   * _waiters 由构造函数 markRaw，避免经 reactive 代理后 get() 返回代理对象，
   * 导致 `slots.get(channel) === w` 恒 false、等待槽永远删不掉。
   */
  waitHuman(channel = 'response') {
    const slots = this._waiters || (this._waiters = markRaw(new Map()))
    let queue = slots.get(channel)
    if (!queue) { queue = []; slots.set(channel, queue) }

    return new Promise((resolve) => {
      const w = { channel, settled: false, timer: null, done: null, queue }
      const done = (action) => {
        if (w.settled) return
        w.settled = true
        if (w.timer) { clearTimeout(w.timer); w.timer = null }
        const i = w.queue.indexOf(w)
        if (i >= 0) w.queue.splice(i, 1)
        if (!w.queue.length) slots.delete(channel)
        this._refreshHumanResolve()
        resolve(action)
      }
      w.done = done
      queue.push(w)
      this._refreshHumanResolve()
      /* 只有「等回答」的槽才设 30s 超时。'play' 是玩家自己的用兵阶段，
         出牌 / 选目标可以慢慢想：给它加超时会在玩家还没点目标时就把回合
         强行推进，UI 的选目标高亮态却还留着，表现为「卡死 / 无法指定目标」。*/
      if (channel !== 'play') w.timer = setTimeout(() => done(null), 30000)
    })
  },

  /** 兼容旧字段：始终指向当前最新的存活等待者（没有则为 null） */
  _refreshHumanResolve() {
    const slots = this._waiters
    let last = null
    if (slots && slots.size) {
      for (const q of slots.values()) if (q.length) last = q[q.length - 1]
    }
    this.humanResolve = last ? last.done : null
  },

  /** 是否有等待中的玩家操作（看门狗用） */
  hasWaiter(channel) {
    const slots = this._waiters
    if (!slots || !slots.size) return false
    if (channel) {
      const q = slots.get(channel)
      return !!(q && q.length)
    }
    for (const q of slots.values()) if (q.length) return true
    return false
  },

  /**
   * 结算等待。
   * @param {*} action 提交的操作
   * @param {String} channel 指定槽位；不传则清空全部（对局结束 / 退出 / 看门狗）
   */
  resolveWait(action, channel) {
    const slots = this._waiters
    if (!slots || !slots.size) return
    if (channel) {
      const q = slots.get(channel)
      // 只结算队首（即当前显示的那条询问），与 pushPending 的队列一一对应
      if (q && q.length) q[0].done(action)
      return
    }
    for (const [, q] of Array.from(slots.entries())) {
      for (const w of q.slice()) w.done(action)
    }
  },

  /* ==================== 响应询问队列 ====================
   * state.pending 只有一个槽，但出牌是「发射后不管」的异步链，可能与主循环的
   * 询问并存。旧写法在链尾直接 state.pending = null，会把另一条链刚弹出的
   * 询问抹掉：玩家看不到按钮，链却还在等，界面就像卡死。
   * 给每条询问发 token，只清自己的；排队后 state.pending 始终显示队首那条，
   * 与 waitHuman 的 FIFO 队列顺序一致。
   */
  pushPending(pending) {
    const q = this._pendingQueue || (this._pendingQueue = markRaw([]))
    const token = ++this._pendingToken
    pending.ptok = token
    q.push({ token, pending })
    if (!this.state.pending) this.state.pending = pending
    return token
  },

  clearPending(token) {
    const q = this._pendingQueue
    if (!q || !q.length) return
    const i = q.findIndex((x) => x.token === token)
    if (i < 0) return
    const shown = this.state.pending
    const wasShown = shown && shown.ptok === token
    q.splice(i, 1)
    if (wasShown || !shown) this.state.pending = q.length ? q[0].pending : null
  },

  clearAllPending() {
    if (this._pendingQueue) this._pendingQueue.length = 0
    this._pendingToken = 0
    this.state.pending = null
  },

  /** 玩家点出牌响应（挡 / 救 / 缓策 / 改判 / 惑敌 / 跳过） */
  submit(action) {
    this.resolveWait(action, 'response')
  },

  /** 玩家点「收兵」 */
  endPlayPhase() {
    if (this.state.stage !== 'play') return
    this.resolveWait({ type: 'endPlay' }, 'play')
  },

  confirmDiscard(uids) {
    const p = this.state.pending
    if (!p || p.kind !== 'discard') return
    const seat = this.state.seats[p.idx]
    for (const uid of uids) {
      const card = seat.hand.find((c) => c.uid === uid)
      if (card) this.dropCard(seat, card)
    }
    // 手牌上限必须和 discardPhase 一致：昭烈（lord_support）是 hp + 2，
    // 旧代码写死 <= hp，导致刘备玩家弃满应弃张数后仍不解锁，收兵阶段卡住
    const limit = seat.hp + (this.hasEffect(seat, 'lord_support') ? 2 : 0)
    if (seat.hand.length <= limit) {
      this.resolveWait({ type: 'discardDone' }, 'discard')
    }
  },

  async tick(seat, ms) {
    await wait(seat && seat.isAI && this.state.phase === 'playing' ? Math.min(ms, this.speed) : ms / 2)
  },

  log(text, tone) {
    this.state.log.push({ text, tone: tone || 'sys', round: this.state.round })
    if (this.state.log.length > 200) this.state.log.shift()
  },

  warn(text) {
    this.log(text, 'warn')
  },

  afterAction() {
    if (this.state.phase === 'playing') this.checkWin()
  },

  /** 退出游戏（清理看门狗、询问队列与全部异步等待，避免旧局残留推进） */
  destroy() {
    this.running = false
    if (this._watchdogTimer) { clearInterval(this._watchdogTimer); this._watchdogTimer = null }
    this.clearAllPending()
    this.resolveWait(null)
  },
}
