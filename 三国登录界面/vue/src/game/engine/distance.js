/**
 * 距离计算、目标筛选、玩家交互通道、日志等杂项（Game 的方法 mixin）
 */
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
   * 旧实现全局只有一个 humanResolve + 递增 token：新等待一挂起，旧等待的
   * resolve 就被 token 校验永久作废（连 30s 超时都救不回来），整局卡死。
   * 现按用途分槽，互不覆盖：
   *   'play'     主循环等「收兵」
   *   'discard'  收兵阶段等「确定弃牌」
   *   'response' 各类响应询问（挡 / 救 / 缓策 / 改判 / 惑敌）
   * resolveWait 不传 channel 时清空所有槽，供胜负已分、退出、看门狗兜底。
   */
  waitHuman(channel = 'response') {
    const slots = this._waiters || (this._waiters = new Map())
    // 同槽重复等待属异常：先按「放弃」结算旧链，绝不留下永久挂起的 Promise
    const prev = slots.get(channel)
    if (prev) prev.done(null)

    return new Promise((resolve) => {
      const w = { channel, settled: false, timer: null, done: null }
      const done = (action) => {
        if (w.settled) return
        w.settled = true
        if (w.timer) { clearTimeout(w.timer); w.timer = null }
        if (slots.get(channel) === w) slots.delete(channel)
        this._refreshHumanResolve()
        resolve(action)
      }
      w.done = done
      slots.set(channel, w)
      this._refreshHumanResolve()
      // 每个等待独立 30s 超时，超时按「跳过」结算，不让任何一条链永久挂起
      w.timer = setTimeout(() => done(null), 30000)
    })
  },

  /** 兼容旧字段：始终指向当前最新的存活等待者（没有则为 null） */
  _refreshHumanResolve() {
    const slots = this._waiters
    const list = slots && slots.size ? Array.from(slots.values()) : []
    this.humanResolve = list.length ? list[list.length - 1].done : null
  },

  /** 是否有等待中的玩家操作（看门狗用） */
  hasWaiter(channel) {
    const slots = this._waiters
    if (!slots || !slots.size) return false
    return channel ? slots.has(channel) : true
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
      const w = slots.get(channel)
      if (w) w.done(action)
      return
    }
    for (const w of Array.from(slots.values())) w.done(action)
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

  /** 退出游戏（清理看门狗与全部异步等待，避免旧局残留推进） */
  destroy() {
    this.running = false
    if (this._watchdogTimer) { clearInterval(this._watchdogTimer); this._watchdogTimer = null }
    this.resolveWait(null)
  },
}
