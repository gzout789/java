/**
 * 烽烟三国杀 · 核心引擎
 *
 * 只负责规则推进，不涉及任何 DOM。UI 读取 state 渲染，通过方法把玩家操作喂进来；
 * AI 的思考在 ai.js，由本引擎在对应时机调用。
 *
 * 回合六阶段：启策 → 判定 → 征粮 → 用兵 → 收兵 → 收阵
 *
 * 代码组织（2026-11-02 拆分）：本文件保留「类骨架 + 开局主流程」，其余方法按职责
 * 拆分到 engine/ 下的 mixin 模块，经 Object.assign(Game.prototype, ...) 合并，
 * 方法与实例状态（this.state）关系不变，纯组织性重构，无运行时行为变化。
 */
import { reactive, markRaw, watch } from 'vue'
import {
  ROLES, ROLE_SETUP,
  buildDeck, judgeResult, shuffle, cardName, suitSymbol
} from './rules.js'
import { aiPlayTurn, aiPickDiscard } from './ai.js'
import { deckMethods } from './engine/deck.js'
import { combatMethods } from './engine/combat.js'
import { damageMethods } from './engine/damage.js'
import { skillMethods } from './engine/skills.js'
import { distanceMethods } from './engine/distance.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export class Game {
  /**
   * @param {Array} heroes 英雄榜武将（已 toGameHero 处理）
   * @param {Object} opts  { seatCount, playerName, speed }
   */
  constructor(heroes, opts = {}) {
    this.heroes = heroes
    this.seatCount = opts.seatCount || 5
    this.playerName = opts.playerName || '你'
    /* 单机组队开局时，把同袍名号挂到其余席位上（不足的席位仍用武将名） */
    this.seatLabels = opts.seatLabels || []

    /* ---- 联机席位 ----
     * humanSeats：由真人操控的席位 idx 列表（其余席位交给 AI）
     * mySeatIdx ：本机玩家坐在第几席（单机恒为 0）
     * seatNames ：idx -> 名号，联机时用于座位标签
     * remote    ：队员端影子实例——不跑主循环，动作一律转发给房主
     */
    this.humanSeats = opts.humanSeats || [0]
    this.mySeatIdx = opts.mySeatIdx ?? 0
    this.seatNames = opts.seatNames || {}
    this.online = opts.online !== undefined ? !!opts.online : this.humanSeats.length > 1
    this.remote = !!opts.remote
    this.onAction = opts.onAction || null
    this.onSnapshot = opts.onSnapshot || null

    this.speed = opts.speed || 620
    this.humanResolve = null // 兼容字段：由 _refreshHumanResolve() 维护，指向最新等待者
    /* 必须 markRaw：Game 实例被组件放进 ref() 后会变成响应式代理，普通 Map 经代理
       get() 返回的是「代理对象」，waitHuman 里的 slots.get(channel) === w 恒为 false，
       等待槽永远删不掉 → hasWaiter() 恒真 → 看门狗每 25s 误触发一次。*/
    this._waiters = markRaw(new Map()) // 槽键 -> 等待队列，见 distance.js 的 waitHuman
    this._pendingQueue = markRaw([]) // 响应询问队列，见 distance.js 的 pushPending
    this._pendingToken = 0
    this.running = false
    this._lastProgress = 0 // 看门狗：最近一次回合推进的时间戳
    this._watchdogTimer = null
    this._snapTimer = null
    this._stopWatch = null

    this.state = reactive({
      phase: 'select', // select → playing → over
      seats: [],
      deck: [],
      deckCount: null, // 联机快照里牌堆只带数量；为 null 时 UI 回退到 deck.length
      discard: [],
      turnIdx: 0,
      round: 1,
      stage: '',
      log: [],
      pending: null, // 等待某个角色的响应
      selection: null, // 玩家正在选目标
      candidates: [], // 选将候选
      winner: null, // { side, text }
      lastKilled: null
    })

    /* 队员端把动作方法替换成协议发送；规则查询方法（usableAs / slashTargets 等）
       仍走原引擎实现，因此 UI 层无需为联机重写任何交互逻辑。 */
    if (this.remote) this._installRemoteProxy()
    /* 房主端深度监听 state，变化后节流生成按席位脱敏的快照交给上层广播 */
    if (!this.remote && this.onSnapshot) {
      this._stopWatch = watch(this.state, () => this._scheduleSnapshot(), { deep: true, flush: 'post' })
    }
  }

  /* ==================== 开局 ==================== */

  /** 抽 5 名武将给玩家挑选 */
  prepare() {
    const pool = shuffle(this.heroes).slice(0, Math.max(this.seatCount, 5))
    this.state.candidates = pool.slice(0, 5)
    this.state.phase = 'select'
    this.log('烽烟四起，群雄列阵于前。请择一良将出战。', 'sys')
    return this.state.candidates
  }

  /**
   * 选将后开局：分配身份、发牌。
   * 单机传 heroId；联机传 { 席位idx: heroId }（房主汇总全体真人选择后调用）。
   */
  start(heroChoices) {
    const raw = (heroChoices && typeof heroChoices === 'object')
      ? heroChoices
      : { [this.mySeatIdx]: heroChoices }
    const chosenBy = {}
    const used = new Set()
    for (const key of Object.keys(raw)) {
      const h = this.state.candidates.find((x) => x.id === raw[key]) || this.state.candidates[0]
      if (!h) continue
      chosenBy[Number(key)] = h
      used.add(h.id)
    }
    const rest = shuffle(this.heroes.filter((h) => !used.has(h.id)))
    let aiCursor = 0

    const roles = shuffle(ROLE_SETUP[this.seatCount] || ROLE_SETUP[5])
    const seats = []
    for (let i = 0; i < this.seatCount; i++) {
      const hero = chosenBy[i] || rest[aiCursor++]
      const role = roles[i]
      const maxHp = hero.hp + (role === 'lord' ? 1 : 0)
      seats.push({
        idx: i,
        role,
        roleOpen: role === 'lord',
        hero,
        maxHp,
        hp: maxHp,
        hand: [],
        equip: { weapon: null, armor: null, minusHorse: null, plusHorse: null },
        traps: [],
        alive: true,
        isAI: !this.humanSeats.includes(i),
        label: this.seatNames[i] || (i === 0 ? this.playerName : (this.seatLabels[i - 1] || hero.name)),
        // 回合内标记
        slashCount: 0,
        onceUsed: {},
        secretUsed: false,
        boost: 0,
        // marks[目标座位] = 我攻击过他几次，AI 靠它推断敌友
        marks: {}
      })
    }
    this.state.seats = seats
    this.state.deck = buildDeck()
    this.state.discard = []
    this.state.turnIdx = 0
    this.state.round = 1
    this.state.phase = 'playing'
    this.state.winner = null

    for (const s of seats) this.drawCards(s, 4)

    const me = seats[this.mySeatIdx] || seats[0]
    this.log(`汉室倾颓，${this.seatCount} 路豪杰会于阵前。`, 'sys')
    if (this.online) {
      // 战报是广播给全体同袍的，不能出现只对本机成立的「你」
      this.log('汉主已明置身份，其余诸将暗藏机心；各将身份仅自己可见。', 'sys')
    } else {
      this.log(`你抽得身份【${ROLES[me.role].name}】，${ROLES[me.role].goal}。`, me.role === 'lord' ? 'gold' : 'sys')
      this.log('汉主已明置身份，其余诸将暗藏机心。', 'sys')
    }

    this.running = true
    this._startWatchdog()
    this.loop()
  }

  /* ==================== 主循环 ==================== */

  async loop() {
    while (this.running && this.state.phase === 'playing') {
      const seat = this.state.seats[this.state.turnIdx]
      if (!seat) break
      if (!seat.alive) {
        const before = this.state.turnIdx
        this.nextTurn()
        // nextTurn 找不到存活者时不会改 turnIdx，旧代码会在这里同步空转，
        // 直接把浏览器标签页锁死。兜底判和局并退出循环。
        if (this.state.turnIdx === before) {
          this.warn('阵中已无存活角色，战事终止。')
          if (!this.state.winner) {
            this.state.winner = { side: 'draw', text: '两败俱伤，无人生还', playerWin: false }
          }
          this.state.phase = 'over'
          break
        }
        continue
      }
      this._lastProgress = Date.now()
      await this.runTurn(seat)
      if (this.state.phase !== 'playing') break
      this.nextTurn()
    }
    this._stopWatchdog()
  }

  /* ==================== 看门狗 ====================
   * 兜底监测主循环是否卡死：若对局进行中长时间无回合推进，
   * 先尝试自愈（跳过卡住的玩家等待），仍无改善则打日志告警。
   * 与 waitHuman 的 30s 超时互为双保险，正常情况下永不触发。
   */
  _startWatchdog() {
    this._lastProgress = Date.now()
    this._stopWatchdog()
    this._watchdogTimer = setInterval(() => {
      if (this.state.phase !== 'playing') return
      const idle = Date.now() - this._lastProgress
      // 阈值给到 25s，早于 waitHuman 的 30s 超时，正常情况下 waitHuman 会先自愈。
      if (idle < 25000) return
      /* 只自愈「等玩家回答」的槽位。'play' 是玩家自己的用兵阶段，出牌 / 选目标
         本来就可以慢慢想，绝不能因为静置久了就被强行结算：旧实现会在玩家还没
         点目标时把回合推进到收兵甚至下家，而 UI 的 selecting 是组件本地状态、
         完全不知情，高亮座位还在却点了没反应，看起来就是「卡死 + 无法指定目标」。*/
      if (this.hasWaiter('response') || this.hasWaiter('discard')) {
        this.warn('对局疑似停滞，已自动跳过当前响应以恢复推进。')
        this.resolveWait(null, 'response')
        this.resolveWait(null, 'discard')
      } else if (this.hasWaiter('play')) {
        // 玩家仍在正常出牌：只重置计时，不结算任何等待，也不打告警
        this._lastProgress = Date.now()
        return
      } else {
        this.warn('对局疑似停滞，请留意战报。')
      }
      this._lastProgress = Date.now()
    }, 5000)
  }

  _stopWatchdog() {
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer)
      this._watchdogTimer = null
    }
  }

  /* ==================== 联机：动作代理 / 快照 ==================== */

  /** 队员端影子实例：把动作方法替换成协议发送，规则查询仍走原实现 */
  _installRemoteProxy() {
    const send = (kind, payload) => {
      if (this.onAction) this.onAction(kind, payload || {})
    }
    const idxOf = (seat) => (seat && typeof seat.idx === 'number' ? seat.idx : this.mySeatIdx)
    this.useCard = (seat, card, targetIdx, as) => send('playCard', {
      idx: idxOf(seat), cardUid: card && card.uid, targetIdx, as: as || null
    })
    this.useSkill = (seat, payload) => send('skill', { idx: idxOf(seat), payload: payload || {} })
    this.useSecretSkill = (seat, payload) => send('secretSkill', { idx: idxOf(seat), payload: payload || {} })
    this.submit = (action) => send('respond', { idx: this.mySeatIdx, action: action || null })
    this.endPlayPhase = () => send('endPlay', { idx: this.mySeatIdx })
    this.confirmDiscard = (uids) => send('discard', { idx: this.mySeatIdx, uids: uids || [] })
    this.start = () => {} // 队员端由快照驱动，绝不本地开局
  }

  /** 房主端把队员动作还原成一次本地引擎调用 */
  applyRemoteAction(kind, p) {
    const data = p || {}
    const seat = this.state.seats[data.idx]
    const guard = (r) => Promise.resolve(r).catch((e) => console.error('[联机] 动作结算异常', e))
    switch (kind) {
      case 'playCard': {
        if (!seat) return
        const card = seat.hand.find((c) => c.uid === data.cardUid)
        if (!card) return
        guard(this.useCard(seat, card, data.targetIdx, data.as || undefined))
        return
      }
      case 'skill':
        if (seat) guard(this.useSkill(seat, data.payload || {}))
        return
      case 'secretSkill':
        if (seat) guard(this.useSecretSkill(seat, data.payload || {}))
        return
      case 'respond':
        this.submit(data.action || null, data.idx)
        return
      case 'endPlay':
        this.endPlayPhase(data.idx)
        return
      case 'discard':
        this.confirmDiscard(data.uids || [], data.idx)
        return
      default:
        return
    }
  }

  /** 状态变化后节流生成快照，避免一次结算里连发几十帧 */
  _scheduleSnapshot() {
    if (!this.onSnapshot || this._snapTimer) return
    this._snapTimer = setTimeout(() => {
      this._snapTimer = null
      try {
        this.onSnapshot(this.snapshotViews())
      } catch (e) {
        console.error('[联机] 快照生成失败', e)
      }
    }, 90)
  }

  /**
   * 按真人席位生成脱敏视图：
   * - 别人的手牌只留数量占位，牌堆只留数量（不能让队员看到未来摸的牌）
   * - 未明置身份在结算前一律藏掉，结算后全部翻开
   * - 胜负按「这一席位自己的身份」重算
   * - 响应文案里的「你」改写成被询问者的名号
   */
  snapshotViews() {
    const views = {}
    for (const idx of this.humanSeats) {
      const v = JSON.parse(JSON.stringify(this.state))
      v.mySeatIdx = idx
      v.deckCount = v.deck.length
      v.deck = []
      for (const s of v.seats) {
        if (s.idx !== idx) {
          s.handCount = s.hand.length
          s.hand = Array.from({ length: s.handCount }, () => ({ hidden: true }))
          s.marks = {}
          if (v.phase !== 'over' && !s.roleOpen) s.role = 'hidden'
        }
      }
      if (v.phase === 'over') for (const s of v.seats) s.roleOpen = true
      if (v.pending && v.pending.idx !== idx && typeof v.pending.text === 'string') {
        const who = v.seats[v.pending.idx]
        v.pending.text = v.pending.text.replace(/你/g, who ? who.label : '该将')
      }
      if (v.winner) v.winner.playerWin = this.winFor(idx, v.winner)
      views[String(idx)] = v
    }
    return views
  }

  /** 某一席位的身份是否属于获胜方 */
  winFor(idx, winner) {
    const s = this.state.seats[idx]
    if (!s) return false
    const role = s.role
    return (
      (winner.side === 'lord' && (role === 'lord' || role === 'loyal')) ||
      (winner.side === 'rebel' && role === 'rebel') ||
      (winner.side === 'spy' && role === 'spy')
    )
  }

  /** 队员端把一份脱敏快照写进本地 state，供 UI 与规则查询使用 */
  applyView(view) {
    if (!view) return
    const s = this.state
    s.phase = view.phase
    s.seats = view.seats || []
    s.deck = view.deck || []
    s.deckCount = typeof view.deckCount === 'number' ? view.deckCount : null
    s.discard = view.discard || []
    s.turnIdx = view.turnIdx || 0
    s.round = view.round || 1
    s.stage = view.stage || ''
    s.log = view.log || []
    s.pending = view.pending || null
    s.selection = null
    s.candidates = view.candidates || []
    s.winner = view.winner || null
    s.lastKilled = view.lastKilled || null
  }

  nextTurn() {
    const n = this.state.seats.length
    let idx = this.state.turnIdx
    for (let i = 1; i <= n; i++) {
      const cand = (idx + i) % n
      if (this.state.seats[cand].alive) {
        if (cand === 0) this.state.round++
        this.state.turnIdx = cand
        return
      }
    }
  }

  async runTurn(seat) {
    // 1. 启策
    this.state.stage = 'start'
    seat.slashCount = 0
    seat.onceUsed = {}
    seat.boost = 0
    // 挟天子的禁击只在自己回合内生效，回合结束自然解除
    if (seat.slashBanned) {
      seat.noSlashThisTurn = true
      seat.slashBanned = false
      this.log(`${seat.label} 被挟天子以令诸侯，本回合用兵不得出【击】。`, 'warn')
    } else {
      seat.noSlashThisTurn = false
    }
    if (!seat.isAI) await wait(120)

    // 2. 判定
    this.state.stage = 'judge'
    await this.judgePhase(seat)
    if (!seat.alive) return

    // 3. 征粮
    this.state.stage = 'draw'
    const blocked = seat.trapEffects && seat.trapEffects.skipDraw
    if (blocked) {
      this.log(`${seat.label} 被断粮，征粮无获。`, 'warn')
    } else {
      this.drawCards(seat, 2)
    }
    await this.tick(seat, 320)

    // 4. 用兵
    this.state.stage = 'play'
    if (seat.isAI) {
      await aiPlayTurn(this, seat)
    } else {
      // 联机按席位隔离等待槽：多人各自出牌 / 收兵时互不顶掉
      await this.waitHuman('play', seat.idx)
    }
    if (this.state.phase !== 'playing') return

    // 5. 收兵
    this.state.stage = 'discard'
    await this.discardPhase(seat)
    if (!seat.alive) return

    // 6. 收阵
    this.state.stage = 'end'
    seat.trapEffects = null
    if (this.hasEffect(seat, 'end_draw')) {
      const sk = this.skillOf(seat, 'end_draw')
      this.drawCards(seat, 1)
      this.log(`${seat.label} 的【${sk.name}】生效，回眸一望，摸一张牌。`, 'skill')
    }
    await this.tick(seat, 200)
  }

  async judgePhase(seat) {
    if (!seat.traps.length) return
    // 后进先判
    const traps = seat.traps.slice().reverse()
    seat.traps = []
    const effects = []
    for (const card of traps) {
      const drawn = this.drawRaw(1)
      if (!drawn.length) break
      let judgeCard = drawn[0]
      // 鬼才：判定牌生效前，其他角色可打出一张手牌改判
      const swapped = await this.judgeSwap(seat, card.key, judgeCard)
      if (swapped) judgeCard = swapped
      const hit = judgeResult(card.key, judgeCard)
      this.state.discard.push(judgeCard)
      /* 判定牌是 judgeCard，不是被判定那张锦囊；这里之前误用了 card.key，
         会打出「2 困局」这种看不懂的战报 */
      this.log(
        `${seat.label} 的【${cardName(card.key)}】判定：${judgeCard.num}${suitSymbol(judgeCard.suit)}【${cardName(judgeCard.key)}】 → ${hit ? '凶' : '吉'}`,
        hit ? 'hit' : 'good'
      )
      await this.tick(seat, 420)
      if (hit) {
        if (card.key === 'trapBolt') {
          this.damage(null, seat, 2, '惊雷')
        } else if (card.key === 'trapSlash') {
          effects.push('skipSlash')
        } else if (card.key === 'trapDraw') {
          effects.push('skipDraw')
        }
      } else if (card.key === 'trapBolt') {
        // 未触发的惊雷传给下家
        const next = this.nextSeat(seat)
        if (next && next.alive) {
          next.traps.push(card)
          this.log(`惊雷未落，移至 ${next.label} 帐前。`, 'warn')
        }
      }
    }
    seat.trapEffects = {
      skipSlash: effects.includes('skipSlash'),
      skipDraw: effects.includes('skipDraw')
    }
  }

  /**
   * 鬼才（司马懿）：判定牌生效前，其他角色可打出一张手牌代替之。
   * AI 按敌友立场自动改判；玩家弹出询问，点一张手牌改判、点「不改判」跳过。
   * 返回替代判定牌（含 uid 不会与手牌冲突），不改判返回 null。
   */
  async judgeSwap(target, trapKey, judgeCard) {
    const hit = judgeResult(trapKey, judgeCard)
    for (const s of this.state.seats) {
      if (!s.alive || s.idx === target.idx) continue
      if (!this.hasEffect(s, 'judge_swap') || s.onceUsed.judgeSwap) continue
      if (!s.hand.length) continue
      const sk = this.skillOf(s, 'judge_swap')
      if (s.isAI) {
        // 与被判定者有交战记录 → 让其判定为凶；否则救一把，让判定为吉
        const isEnemy = (s.marks[target.idx] || 0) > 0 || (target.marks[s.idx] || 0) > 0
        const wantHit = isEnemy
        if (hit === wantHit) continue
        const flip = s.hand.find((c) => judgeResult(trapKey, c) === wantHit)
        if (!flip) continue
        this.removeHand(s, flip)
        this.state.discard.push(judgeCard)
        s.onceUsed.judgeSwap = true
        this.log(`${s.label} 发动【${sk.name}】，天机可改，判定牌已换。`, 'skill')
        return flip
      }
      // 玩家询问改判
      const tok = this.pushPending({
        kind: 'judgeSwap',
        idx: s.idx,
        trapKey,
        oldCard: judgeCard,
        text: `${target.label} 的【${cardName(trapKey)}】判定中（${judgeCard.num}${suitSymbol(judgeCard.suit)}），是否打出手牌以【${sk.name}】改判？`
      })
      const action = await this.waitHuman('response', s.idx)
      this.clearPending(tok)
      if (action && action.type === 'judgeSwap') {
        const card = s.hand.find((c) => c.uid === action.cardUid)
        if (card) {
          this.removeHand(s, card)
          this.state.discard.push(judgeCard)
          s.onceUsed.judgeSwap = true
          this.log(`${s.label} 发动【${sk.name}】，判定牌已换。`, 'skill')
          return card
        }
      }
    }
    return null
  }

  async discardPhase(seat) {
    // 昭烈：手牌上限 +2
    const limit = seat.hp + (this.hasEffect(seat, 'lord_support') ? 2 : 0)
    const over = seat.hand.length - limit
    if (over <= 0) return
    if (this.hasEffect(seat, 'no_discard') && seat.slashCount === 0) {
      this.log(`${seat.label} 本回合未动刀兵（克己），不必弃牌。`, 'skill')
      return
    }
    if (seat.isAI) {
      const drop = aiPickDiscard(seat, over)
      for (const c of drop) this.dropCard(seat, c)
      this.log(`${seat.label} 弃置 ${over} 张手牌。`, 'sys')
    } else {
      const tok = this.pushPending({ kind: 'discard', idx: seat.idx, need: over })
      await this.waitHuman('discard', seat.idx) // 独立槽，见 confirmDiscard
      this.clearPending(tok)
    }
  }
}

// 合并拆分的模块方法（牌堆 / 战斗 / 伤害 / 技能 / 距离交互）
Object.assign(Game.prototype, deckMethods)
Object.assign(Game.prototype, combatMethods)
Object.assign(Game.prototype, damageMethods)
Object.assign(Game.prototype, skillMethods)
Object.assign(Game.prototype, distanceMethods)

export function createGame(heroes, opts) {
  return new Game(heroes, opts)
}
