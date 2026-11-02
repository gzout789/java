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

  waitHuman() {
    return new Promise((resolve) => {
      this.humanResolve = resolve
    })
  },

  /** 玩家提交操作 */
  submit(action) {
    this.resolveWait(action)
  },

  resolveWait(action) {
    const r = this.humanResolve
    this.humanResolve = null
    if (r) r(action)
  },

  /** 玩家点「收兵」 */
  endPlayPhase() {
    if (this.state.stage !== 'play') return
    this.resolveWait({ type: 'endPlay' })
  },

  confirmDiscard(uids) {
    const p = this.state.pending
    if (!p || p.kind !== 'discard') return
    const seat = this.state.seats[p.idx]
    for (const uid of uids) {
      const card = seat.hand.find((c) => c.uid === uid)
      if (card) this.dropCard(seat, card)
    }
    if (seat.hand.length <= seat.hp) {
      this.resolveWait({ type: 'discardDone' })
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

  /** 退出游戏（清理异步等待） */
  destroy() {
    this.running = false
    this.resolveWait(null)
  },
}
