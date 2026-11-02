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
import { reactive } from 'vue'
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
    this.speed = opts.speed || 620
    this.humanResolve = null
    this.running = false

    this.state = reactive({
      phase: 'select', // select → playing → over
      seats: [],
      deck: [],
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

  /** 玩家选将后开局：分配身份、发牌 */
  start(heroId) {
    const chosen = this.state.candidates.find((h) => h.id === heroId) || this.state.candidates[0]
    const rest = shuffle(this.heroes.filter((h) => h.id !== chosen.id))

    const roles = shuffle(ROLE_SETUP[this.seatCount] || ROLE_SETUP[5])
    const seats = []
    for (let i = 0; i < this.seatCount; i++) {
      const hero = i === 0 ? chosen : rest[i - 1]
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
        isAI: i !== 0,
        label: i === 0 ? this.playerName : hero.name,
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

    const me = seats[0]
    this.log(`汉室倾颓，${this.seatCount} 路豪杰会于阵前。`, 'sys')
    this.log(`你抽得身份【${ROLES[me.role].name}】，${ROLES[me.role].goal}。`, me.role === 'lord' ? 'gold' : 'sys')
    this.log('汉主已明置身份，其余诸将暗藏机心。', 'sys')

    this.running = true
    this.loop()
  }

  /* ==================== 主循环 ==================== */

  async loop() {
    while (this.running && this.state.phase === 'playing') {
      const seat = this.state.seats[this.state.turnIdx]
      if (!seat) break
      if (!seat.alive) {
        this.nextTurn()
        continue
      }
      await this.runTurn(seat)
      if (this.state.phase !== 'playing') break
      this.nextTurn()
    }
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
      await this.waitHuman() // 玩家点「收兵」结束
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
      this.state.pending = {
        kind: 'judgeSwap',
        idx: s.idx,
        trapKey,
        oldCard: judgeCard,
        text: `${target.label} 的【${cardName(trapKey)}】判定中（${judgeCard.num}${suitSymbol(judgeCard.suit)}），是否打出手牌以【${sk.name}】改判？`
      }
      const action = await this.waitHuman()
      this.state.pending = null
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
      this.state.pending = { kind: 'discard', idx: seat.idx, need: over }
      await this.waitHuman()
      this.state.pending = null
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
