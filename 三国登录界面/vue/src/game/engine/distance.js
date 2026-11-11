/**
 * 距离计算、目标筛选、玩家交互通道、日志等杂项（Game 的方法 mixin）
 */
import { markRaw } from 'vue'
import { EQUIPS } from '../rules.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 等待槽键：联机时按席位隔离，单机退化为纯 channel */
function slotKey(channel, idx) {
  return idx == null ? channel : channel + '#' + idx
}

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
   *
   * 联机扩展：槽键追加席位号（'response#2'），让多名真人可以同时各自等待。
   * waitHuman 未显式传 idx 时，自动取当前 state.pending.idx —— 这样 combat.js /
   * damage.js 里原有的 waitHuman() 调用无需改动即可正确路由到被询问的席位。
   * _waiters 由构造函数 markRaw，避免经 reactive 代理后 get() 返回代理对象。
   */
  waitHuman(channel = 'response', idx = null) {
    if (idx == null && channel !== 'play' && this.state.pending) {
      idx = this.state.pending.idx
    }
    const key = slotKey(channel, idx)
    const slots = this._waiters || (this._waiters = markRaw(new Map()))
    let queue = slots.get(key)
    if (!queue) { queue = []; slots.set(key, queue) }

    return new Promise((resolve) => {
      const w = { channel, settled: false, timer: null, done: null, queue }
      const done = (action) => {
        if (w.settled) return
        w.settled = true
        if (w.timer) { clearTimeout(w.timer); w.timer = null }
        const i = w.queue.indexOf(w)
        if (i >= 0) w.queue.splice(i, 1)
        if (!w.queue.length) slots.delete(key)
        this._refreshHumanResolve()
        resolve(action)
      }
      w.done = done
      queue.push(w)
      this._refreshHumanResolve()
      /* 只有「等回答」的槽才设 30s 超时。'play' 是玩家自己的用兵阶段，
         出牌 / 选目标可以慢慢想，加超时会把回合强行推进导致界面高亮态失配。*/
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

  /** 是否有等待中的玩家操作（看门狗用）；按 channel 前缀匹配所有席位 */
  hasWaiter(channel) {
    const slots = this._waiters
    if (!slots || !slots.size) return false
    if (!channel) return true
    for (const k of Array.from(slots.keys())) {
      if (k === channel || k.startsWith(channel + '#')) return true
    }
    return false
  },

  /**
   * 结算等待。
   * @param {*} action 提交的操作
   * @param {String} channel 指定槽类；不传则清空全部（对局结束 / 退出 / 看门狗）
   * @param {Number} idx 指定席位；不传则结算该 channel 下所有席位（看门狗 / 结算）
   */
  resolveWait(action, channel, idx) {
    const slots = this._waiters
    if (!slots || !slots.size) return
    if (!channel) {
      for (const [, q] of Array.from(slots.entries())) {
        for (const w of q.slice()) w.done(action)
      }
      return
    }
    if (idx != null) {
      const q = slots.get(slotKey(channel, idx))
      // 只结算队首（即当前显示的那条询问），与 pushPending 的队列一一对应
      if (q && q.length) q[0].done(action)
      return
    }
    for (const [k, q] of Array.from(slots.entries())) {
      if (k !== channel && !k.startsWith(channel + '#')) continue
      for (const w of q.slice()) w.done(action)
    }
  },

  /* ==================== 响应询问队列 ====================
   * state.pending 只有一个槽，但出牌是「发射后不管」的异步链，可能与主循环的
   * 询问并存。给每条询问发 token，只清自己的；排队后 state.pending 始终显示队首。
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

  /** 玩家点出牌响应（挡 / 救 / 缓策 / 改判 / 惑敌 / 跳过）
   *  默认落到 mySeatIdx：联机时房主本地操作不会误结算其他队员的等待槽。 */
  submit(action, idx = this.mySeatIdx) {
    this.resolveWait(action, 'response', idx)
  },

  /** 玩家点「收兵」 */
  endPlayPhase(idx = this.mySeatIdx) {
    if (this.state.stage !== 'play') return
    this.resolveWait({ type: 'endPlay' }, 'play', idx)
  },

  confirmDiscard(uids, idx = this.mySeatIdx) {
    const p = this.state.pending
    if (!p || p.kind !== 'discard') return
    const seat = this.state.seats[p.idx]
    for (const uid of uids) {
      const card = seat.hand.find((c) => c.uid === uid)
      if (card) this.dropCard(seat, card)
    }
    // 手牌上限必须和 discardPhase 一致：昭烈（lord_support）是 hp + 2
    const limit = seat.hp + (this.hasEffect(seat, 'lord_support') ? 2 : 0)
    if (seat.hand.length <= limit) {
      this.resolveWait({ type: 'discardDone' }, 'discard', idx)
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

  /** 退出游戏（清理看门狗、快照监听、询问队列与全部异步等待） */
  destroy() {
    this.running = false
    if (this._watchdogTimer) { clearInterval(this._watchdogTimer); this._watchdogTimer = null }
    if (this._snapTimer) { clearTimeout(this._snapTimer); this._snapTimer = null }
    if (this._stopWatch) { this._stopWatch(); this._stopWatch = null }
    this.clearAllPending()
    this.resolveWait(null)
  },
}
