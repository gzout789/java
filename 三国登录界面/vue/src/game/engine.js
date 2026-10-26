/**
 * 烽烟三国杀 · 核心引擎
 *
 * 只负责规则推进，不涉及任何 DOM。UI 读取 state 渲染，通过方法把玩家操作喂进来；
 * AI 的思考在 ai.js，由本引擎在对应时机调用。
 *
 * 回合六阶段：启策 → 判定 → 征粮 → 用兵 → 收兵 → 收阵
 */
import { reactive } from 'vue'
import {
  ROLES, ROLE_SETUP, CARDS, EQUIPS,
  buildDeck, isEquip, judgeResult, shuffle, cardName, isRedCard, suitSymbol
} from './rules.js'
import { aiPlayTurn, aiAskDodge, aiAskSave, aiAskNegate, aiPickDiscard } from './ai.js'

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
      this.log(
        `${seat.label} 的【${cardName(card.key)}】判定：${judgeCard.num} ${cardName(card.key)} → ${hit ? '凶' : '吉'}`,
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

  /* ==================== 牌堆 ==================== */

  drawRaw(n) {
    const out = []
    for (let i = 0; i < n; i++) {
      if (!this.state.deck.length) {
        if (!this.state.discard.length) break
        this.state.deck = shuffle(this.state.discard)
        this.state.discard = []
        this.log('牌堆已尽，弃牌重洗。', 'sys')
      }
      out.push(this.state.deck.shift())
    }
    return out
  }

  drawCards(seat, n) {
    const cards = this.drawRaw(n)
    seat.hand.push(...cards)
    return cards.length
  }

  /** 弃一张手牌到弃牌堆 */
  dropCard(seat, card) {
    const i = seat.hand.findIndex((c) => c.uid === card.uid)
    if (i >= 0) {
      seat.hand.splice(i, 1)
      this.state.discard.push(card)
    }
  }

  /* ==================== 出牌 ==================== */

  /**
   * 使用一张手牌
   * @param {Object} seat 使用者
   * @param {Object} card 手牌
   * @param {Number} targetIdx 目标座位
   * @param {String} asKey 当作哪张牌使用（武圣/奇袭等）
   */
  async useCard(seat, card, targetIdx, asKey) {
    const key = asKey || card.key
    const target = this.state.seats[targetIdx]

    if (isEquip(key)) {
      this.equipCard(seat, card, key)
      return true
    }

    const def = CARDS[key]
    if (!def) return false

    // 用兵阶段的限制
    if (this.state.stage === 'play' && seat.idx === this.state.turnIdx) {
      if (key === 'slash') {
        const limit = 1 + (this.hasEffect(seat, 'extra_slash') ? 1 : 0)
        if (seat.slashCount >= limit) {
          this.warn('此回合【击】已用尽。')
          return false
        }
        if (seat.noSlashThisTurn) {
          this.warn('你被挟天子以令诸侯，本回合不能用【击】。')
          return false
        }
        if (seat.trapEffects && seat.trapEffects.skipSlash) {
          this.warn('身陷困局，本回合不能用【击】。')
          return false
        }
      }
    }

    // 计略：询问是否有人用【缓策】抵消
    if (def.kind === 'scheme') {
      const negated = await this.askNegate(seat, key, target)
      if (negated) {
        this.state.discard.push(card)
        this.removeHand(seat, card)
        this.log(`${seat.label} 的【${def.name}】被【缓策】化解。`, 'good')
        return true
      }
    }

    this.removeHand(seat, card)

    switch (key) {
      case 'slash': {
        seat.slashCount++
        await this.resolveSlash(seat, target, card)
        break
      }
      case 'heal': {
        if (target.hp >= target.maxHp) {
          this.warn(`${target.label} 气血充盈，无需用【援】。`)
          seat.hand.push(card)
          return false
        }
        // 刚烈：受到的【援】回复量 +1
        let gain = 1
        if (this.hasEffect(target, 'heal_boost')) gain += 1
        target.hp = Math.min(target.maxHp, target.hp + gain)
        this.state.discard.push(card)
        this.log(`${seat.label} 对 ${target.label} 施【援】，回复 ${gain} 点体力。`, 'good')
        break
      }
      case 'draw2': {
        this.state.discard.push(card)
        this.drawCards(seat, 2)
        this.log(`${seat.label} 广纳贤才，摸两张牌。`, 'good')
        break
      }
      case 'steal': {
        this.state.discard.push(card)
        await this.resolveSteal(seat, target)
        break
      }
      case 'duel': {
        this.state.discard.push(card)
        await this.resolveDuel(seat, target)
        break
      }
      case 'trapSlash':
      case 'trapDraw':
      case 'trapBolt': {
        const same = target.traps.find((t) => t.key === key)
        if (same) {
          this.state.discard.push(card)
          this.warn(`${target.label} 计略区已有【${def.name}】，不能叠加。`)
          return false
        }
        target.traps.push(card)
        this.log(`${seat.label} 对 ${target.label} 布下【${def.name}】。`, 'warn')
        break
      }
      default:
        this.state.discard.push(card)
    }
    this.afterAction()
    return true
  }

  removeHand(seat, card) {
    const i = seat.hand.findIndex((c) => c.uid === card.uid)
    if (i >= 0) seat.hand.splice(i, 1)
  }

  equipCard(seat, card, key) {
    const def = EQUIPS[key]
    const old = seat.equip[def.slot]
    this.removeHand(seat, card)
    if (old) {
      this.state.discard.push(old)
      if (old !== card) this.onEquipLost(seat) // 换装失去旧装备，触发枭姬
    }
    seat.equip[def.slot] = card
    this.log(`${seat.label} 装备【${def.name}】——${def.desc}。`, 'skill')
    this.afterAction()
  }

  async resolveSlash(source, target, card) {
    this.log(`${source.label} 对 ${target.label} 挥出一记【击】。`, 'hit')
    source.marks[target.idx] = (source.marks[target.idx] || 0) + 1
    // 无双需双挡；武圣若以红色牌当【击】，同样需双挡（万军之中取首级）
    let need = 1
    if (this.hasEffect(source, 'double_dodge')) need = 2
    else if (this.hasEffect(source, 'slash_any') && card && isRedCard(card) && card.key !== 'slash') need = 2
    let blocked = false
    let used = 0
    while (used < need) {
      const dodge = await this.askDodge(source, target)
      if (!dodge) break
      used++
      this.state.discard.push(dodge)
      this.log(`${target.label} 出【挡】化解。`, 'good')
      if (used >= need) blocked = true
    }
    if (!blocked) {
      const dmg = 1 + (source.boost || 0)
      await this.damage(source, target, dmg, 'slash')
    } else {
      this.log(`${target.label} 挡下这一击。`, 'good')
    }
    this.state.discard.push(card)
    // 反间：周瑜被【击】指定后，可弃一张牌反夺对方手牌
    if (this.hasEffect(target, 'counter_steal') && source.alive && target.hand.length > 0 && target.hp > 0) {
      await this.counterSteal(target, source)
    }
  }

  /** 反间（周瑜）：弃一张手牌，令对方交一张手牌，否则其受 1 点创伤 */
  async counterSteal(from, source) {
    const sk = this.skillOf(from, 'counter_steal')
    // AI 与玩家统一自动结算：弃一张非关键牌发动
    const cost = from.hand.find((c) => c.key !== 'heal') || from.hand[0]
    if (!cost) return
    this.removeHand(from, cost)
    this.state.discard.push(cost)
    this.log(`${from.label} 发动【${sk.name}】，蒋干盗书，将计就计！`, 'skill')
    if (source.hand.length) {
      const i = Math.floor(Math.random() * source.hand.length)
      const card = source.hand.splice(i, 1)[0]
      from.hand.push(card)
      this.log(`${source.label} 交予 ${from.label} 一张手牌。`, 'skill')
    } else {
      this.log(`${source.label} 无牌可交，受 1 点创伤。`, 'skill')
      source.hp -= 1
      if (source.hp <= 0) await this.dying(source, from)
    }
  }

  /** 询问目标是否出【挡】 */
  async askDodge(source, target) {
    const options = target.hand.filter((c) => this.canBeDodge(target, c))
    if (!options.length) return null
    if (target.isAI) {
      const pick = aiAskDodge(this, target, source)
      if (pick) this.removeHand(target, pick)
      return pick
    }
    this.state.pending = {
      kind: 'dodge',
      idx: target.idx,
      from: source.idx,
      text: `${source.label} 对你使用【击】，是否出【挡】？`
    }
    const action = await this.waitHuman()
    this.state.pending = null
    if (action && action.type === 'dodge') {
      const card = target.hand.find((c) => c.uid === action.cardUid)
      if (card) {
        this.removeHand(target, card)
        return card
      }
    }
    return null
  }

  canBeDodge(seat, card) {
    if (card.key === 'dodge') return true
    return this.hasEffect(seat, 'slash_dodge_swap') && card.key === 'slash'
  }

  async resolveSteal(source, target) {
    if (this.hasEffect(target, 'immune_steal')) {
      this.log(`${target.label} 生性谦逊，【探囊】落空。`, 'skill')
      return
    }
    const options = []
    if (target.hand.length) options.push({ type: 'hand' })
    for (const slot of Object.keys(target.equip)) {
      if (target.equip[slot]) options.push({ type: 'equip', slot })
    }
    if (!options.length) {
      this.log(`${target.label} 身无长物，探囊无获。`, 'sys')
      return
    }
    // 随机取其一（AI 与玩家一致，保持简洁）
    const pick = options[Math.floor(Math.random() * options.length)]
    if (pick.type === 'hand') {
      const idx = Math.floor(Math.random() * target.hand.length)
      const card = target.hand.splice(idx, 1)[0]
      source.hand.push(card)
      this.log(`${source.label} 探囊取物，得 ${target.label} 一张手牌。`, 'hit')
    } else {
      const card = target.equip[pick.slot]
      target.equip[pick.slot] = null
      source.hand.push(card)
      this.log(`${source.label} 探囊取物，夺走 ${target.label} 的【${cardName(card.key)}】。`, 'hit')
      this.onEquipLost(target)
    }
  }

  /** 枭姬：失去装备区一张牌后摸两张 */
  onEquipLost(seat) {
    if (this.hasEffect(seat, 'equip_lost_draw2')) {
      const sk = this.skillOf(seat, 'equip_lost_draw2')
      this.drawCards(seat, 2)
      this.log(`${seat.label} 发动【${sk.name}】，武备虽失，战意更盛，摸两张牌。`, 'skill')
    }
  }

  async resolveDuel(source, target) {
    if (this.hasEffect(target, 'immune_duel')) {
      this.log(`${target.label} 生性谦冲，不为【惑敌】所动。`, 'skill')
      return
    }
    this.log(`${source.label} 向 ${target.label} 发起【惑敌】。`, 'warn')
    let turn = target
    let other = source
    for (let round = 0; round < 12; round++) {
      const slash = turn.hand.find((c) => this.canBeSlash(turn, c))
      let played = null
      if (slash) {
        if (turn.isAI) {
          played = slash // 对决中 AI 只要能出就出
        } else {
          this.state.pending = {
            kind: 'duel',
            idx: turn.idx,
            text: `惑敌未决：是否出一张【击】？不出则受 1 点创伤。`
          }
          const action = await this.waitHuman()
          this.state.pending = null
          if (action && action.type === 'duelSlash') {
            played = turn.hand.find((c) => c.uid === action.cardUid)
          }
        }
      }
      if (played) {
        this.removeHand(turn, played)
        this.state.discard.push(played)
        this.log(`${turn.label} 应战，出一记【击】。`, 'sys')
        const t = turn
        turn = other
        other = t
        continue
      }
      await this.damage(other, turn, 1, '惑敌')
      return
    }
  }

  /** 询问是否用【缓策】抵消计略 */
  async askNegate(user, schemeKey, target) {
    for (const seat of this.state.seats) {
      if (!seat.alive || seat.idx === user.idx) continue
      const has = seat.hand.find((c) => c.key === 'negate')
      if (!has) continue
      let use = false
      if (seat.isAI) {
        use = aiAskNegate(this, seat, user, schemeKey, target)
        if (use) {
          const card = seat.hand.find((c) => c.key === 'negate')
          this.removeHand(seat, card)
          this.state.discard.push(card)
          return true
        }
      } else {
        const harmful = target && target.idx === seat.idx
        this.state.pending = {
          kind: 'negate',
          idx: seat.idx,
          text: `${user.label} 使用【${CARDS[schemeKey].name}】${harmful ? '指向你' : ''}，是否以【缓策】化解？`
        }
        const action = await this.waitHuman()
        this.state.pending = null
        if (action && action.type === 'negate') {
          const card = seat.hand.find((c) => c.uid === action.cardUid)
          if (card) {
            this.removeHand(seat, card)
            this.state.discard.push(card)
            return true
          }
        }
      }
    }
    return false
  }

  /* ==================== 伤害 / 濒死 / 阵亡 ==================== */

  async damage(source, target, amount, cause) {
    // 藤甲：来源无兵刃时减伤
    if (target.equip.armor && target.equip.armor.key === 'armor2') {
      if (!source || !source.equip.weapon) {
        amount -= 1
        if (amount <= 0) {
          this.log(`${target.label} 身披藤甲，创伤无存。`, 'skill')
          return
        }
      }
    }
    // 谦冲：计略造成的创伤 -1
    const SCHEME_CAUSES = ['探囊', '困局', '断粮', '惊雷', '惑敌', '乱击', '火烧赤壁', '夷陵', '离间']
    if (this.hasEffect(target, 'scheme_resist') && SCHEME_CAUSES.includes(cause)) {
      amount -= 1
      if (amount <= 0) {
        this.log(`${target.label} 生性谦冲，计略如风过岗。`, 'skill')
        return
      }
    }
    target.hp -= amount
    this.log(`${target.label} 受到 ${amount} 点创伤（${cause || '交锋'}），剩余 ${Math.max(target.hp, 0)} 点体力。`, 'hit')

    // 受伤触发的应策（一名武将可有多个应策，依次结算）
    if (this.hasEffect(target, 'hurt_draw1')) {
      const sk = this.skillOf(target, 'hurt_draw1')
      this.drawCards(target, 1)
      this.log(`${target.label} 发动【${sk.name}】，摸一张牌。`, 'skill')
    }
    if (this.hasEffect(target, 'hurt_draw2')) {
      const sk = this.skillOf(target, 'hurt_draw2')
      this.drawCards(target, 2)
      this.log(`${target.label} 发动【${sk.name}】，摸两张牌。`, 'skill')
    }
    if (this.hasEffect(target, 'hurt_steal') && source && source.hand.length) {
      const sk = this.skillOf(target, 'hurt_steal')
      const i = Math.floor(Math.random() * source.hand.length)
      const card = source.hand.splice(i, 1)[0]
      target.hand.push(card)
      this.log(`${target.label} 发动【${sk.name}】，取得 ${source.label} 一张手牌。`, 'skill')
    }
    if (this.hasEffect(target, 'retaliate') && source && source.alive) {
      const sk = this.skillOf(target, 'retaliate')
      this.log(`${target.label} 发动【${sk.name}】，反噬 ${source.label}。`, 'skill')
      source.hp -= 1
      if (source.hp <= 0) await this.dying(source, target)
    }
    // 拔矢啖睛：受【击】后令来源二选一——弃两张手牌或受 1 点创伤
    if (this.hasEffect(target, 'retaliate_choice') && source && source.alive && cause === 'slash') {
      const sk = this.skillOf(target, 'retaliate_choice')
      this.log(`${target.label} 拔矢啖睛，怒视 ${source.label}！`, 'skill')
      await this.choiceDiscardOrDamage(target, source, sk)
    }

    // 造成击杀伤害后的抽牌（太史慈·神射）
    if (source && cause === 'slash' && this.hasEffect(source, 'slash_draw')) {
      const sk = this.skillOf(source, 'slash_draw')
      this.drawCards(source, 1)
      this.log(`${source.label} 的【${sk.name}】生效，箭无虚发，摸一张牌。`, 'skill')
    }

    if (target.hp <= 0) {
      await this.dying(target, source)
    }
    this.afterAction()
  }

  /** 令 source 二选一：弃两张手牌，或受 1 点创伤（拔矢啖睛） */
  async choiceDiscardOrDamage(from, source, sk) {
    if (source.hand.length >= 2) {
      // 有两张牌可弃：AI 与玩家统一自动弃置（保命优先）
      const drops = [source.hand[0], source.hand[1]]
      for (const c of drops) this.dropCard(source, c)
      this.log(`${source.label} 忍痛弃去两张手牌，避其锋芒。`, 'skill')
      return
    }
    this.log(`${source.label} 无牌可弃，受 ${from.label}【${sk.name}】反噬，受 1 点创伤。`, 'skill')
    source.hp -= 1
    if (source.hp <= 0) await this.dying(source, from)
  }

  /** 濒死：依次询问求援 */
  async dying(target, source) {
    this.log(`${target.label} 气血将尽，命悬一线！`, 'death')
    const n = this.state.seats.length
    for (let i = 0; i < n; i++) {
      const saver = this.state.seats[(target.idx + i) % n]
      // 濒死之人救不了自己，从下家开始依次询问
      if (!saver.alive || saver.idx === target.idx) continue
      // 刮骨：红色手牌也可当【援】
      const heal = this.findHealCard(saver)
      if (!heal) continue
      let use = false
      if (saver.isAI) {
        use = aiAskSave(this, saver, target)
        if (use) {
          const card = this.findHealCard(saver)
          this.removeHand(saver, card)
          this.state.discard.push(card)
          target.hp = 1
          if (card.key !== 'heal') {
            const sk = this.skillOf(saver, 'dying_heal_red')
            this.log(`${saver.label} 发动【${sk.name}】，刮骨去毒，救下 ${target.label}，体力回到 1 点。`, 'good')
          } else {
            this.log(`${saver.label} 以【援】救下 ${target.label}，体力回到 1 点。`, 'good')
          }
          return true
        }
      } else {
        this.state.pending = {
          kind: 'save',
          idx: saver.idx,
          allowRed: this.hasEffect(saver, 'dying_heal_red'),
          text: `${target.label} 濒死，你是否出【援】相救？`
        }
        const action = await this.waitHuman()
        this.state.pending = null
        if (action && action.type === 'save') {
          const card = saver.hand.find((c) => c.uid === action.cardUid)
          if (card) {
            this.removeHand(saver, card)
            this.state.discard.push(card)
            target.hp = 1
            this.log(`你以【${card.key === 'heal' ? '援' : '刮骨'}】救下 ${target.label}，体力回到 1 点。`, 'good')
            return true
          }
        }
      }
    }
    await this.death(target, source)
    return false
  }

  /** 可用于救人【援】的牌：普通【援】；刮骨加持下红牌也算 */
  findHealCard(seat) {
    if (!seat || !seat.hand || !seat.hand.length) return null
    const plain = seat.hand.find((c) => c.key === 'heal')
    if (plain) return plain
    if (this.hasEffect(seat, 'dying_heal_red')) {
      return seat.hand.find((c) => isRedCard(c))
    }
    return null
  }

  async death(target, killer) {
    target.alive = false
    target.roleOpen = true

    // 高平陵：司马懿可尽取阵亡者之物（自动发动，一局一次，纯收益）
    const looter = this.state.seats.find(
      (s) => s.alive && s.idx !== target.idx && !s.secretUsed && this.hasEffect(s, 'secret_loot')
    )
    if (looter) {
      const loot = [...target.hand, ...Object.values(target.equip).filter(Boolean)]
      looter.secretUsed = true
      looter.hand.push(...loot)
      target.hand = []
      target.equip = { weapon: null, armor: null, minusHorse: null, plusHorse: null }
      if (looter.hp < looter.maxHp) looter.hp += 1
      const sk = this.skillOf(looter, 'secret_loot')
      this.log(
        `${looter.label} 发动秘计【${sk.name}】，尽收 ${target.label} 遗物${loot.length ? `（${loot.length} 张）` : ''}，声威大振！`,
        'skill'
      )
    }

    // 手牌与装备进弃牌堆
    this.state.discard.push(...target.hand, ...Object.values(target.equip).filter(Boolean), ...target.traps)
    target.hand = []
    target.equip = { weapon: null, armor: null, minusHorse: null, plusHorse: null }
    target.traps = []

    this.log(`${target.label}（${target.hero.name}）阵亡，翻开身份——【${ROLES[target.role].name}】。`, 'death')
    if (target.role === 'rebel' && killer && killer.alive) {
      this.drawCards(killer, 3)
      this.log(`${killer.label} 剿灭群雄，缴获物资，摸 3 张牌。`, 'good')
    }

    // 袁绍·乱击的秘计在死亡后无意义，无需处理
    this.checkWin()
    await wait(400)
  }

  /* ==================== 胜负 ==================== */

  checkWin() {
    const alive = this.state.seats.filter((s) => s.alive)
    const lord = this.state.seats.find((s) => s.role === 'lord')
    const lordAlive = !!lord && lord.alive
    const rebels = alive.filter((s) => s.role === 'rebel')
    const spies = alive.filter((s) => s.role === 'spy')

    let winner = null
    if (!lordAlive) {
      if (alive.length === 1 && alive[0].role === 'spy') {
        winner = { side: 'spy', text: '隐客独存，揽天下于掌中——隐客胜' }
      } else {
        winner = { side: 'rebel', text: '汉主崩殂，汉室倾覆——群雄胜' }
      }
    } else if (!rebels.length && !spies.length) {
      winner = { side: 'lord', text: '群雄授首，隐客伏诛，天下太平——汉主与忠良胜' }
    } else if (alive.every((s) => s.role === 'spy')) {
      winner = { side: 'spy', text: '群雄与忠良尽殁——隐客胜' }
    }

    if (winner) {
      const me = this.state.seats[0]
      const win =
        (winner.side === 'lord' && (me.role === 'lord' || me.role === 'loyal')) ||
        (winner.side === 'rebel' && me.role === 'rebel') ||
        (winner.side === 'spy' && me.role === 'spy')
      winner.playerWin = win
      this.state.winner = winner
      this.state.phase = 'over'
      this.log(`战事终结：${winner.text}。你${win ? '得胜' : '败北'}。`, win ? 'good' : 'death')
      this.resolveWait(null)
    }
    return winner
  }

  /* ==================== 技能 ==================== */

  /**
   * 该座位是否拥有某效果。
   * 一名武将可有多个技能；常策类技能的 effect 允许是数组（如陆逊·谦冲）。
   */
  hasEffect(seat, effect) {
    if (!seat || !seat.alive) return false
    const list = seat.hero.skills || [seat.hero.skill]
    return list.some(
      (s) => (Array.isArray(s.effect) ? s.effect.includes(effect) : s.effect === effect)
    )
  }

  /** 取拥有某效果的技能对象（用于日志取技能名） */
  skillOf(seat, effect) {
    const list = (seat && seat.hero.skills) || (seat && [seat.hero.skill]) || []
    return list.find(
      (s) => (Array.isArray(s.effect) ? s.effect.includes(effect) : s.effect === effect)
    )
  }

  canBeSlash(seat, card) {
    if (card.key === 'slash') return true
    if (this.hasEffect(seat, 'slash_any')) return true // 武圣：任意牌当击
    if (this.hasEffect(seat, 'slash_dodge_swap') && card.key === 'dodge') return true // 龙胆
    return false
  }

  /** 能否把某张牌当作指定卡牌使用（用于 UI 提示） */
  usableAs(seat, card) {
    const list = [card.key]
    if (this.hasEffect(seat, 'slash_any')) list.push('slash')
    if (this.hasEffect(seat, 'slash_dodge_swap')) {
      if (card.key === 'dodge') list.push('slash')
      if (card.key === 'slash') list.push('dodge')
    }
    if (this.hasEffect(seat, 'black_steal') && !['heart', 'diamond'].includes(card.suit) && card.key !== 'slash') {
      list.push('steal')
    }
    return list
  }

  /** 玩家/AI 发动主动技（多技能武将经 payload.skillEffect 指定是哪一个） */
  async useSkill(seat, payload = {}) {
    const eff = payload.skillEffect || seat.hero.skill.effect
    const sk = this.skillOf(seat, eff) || seat.hero.skill

    // 秘计统一走 useSecretSkill（含袁绍·乱击这类以秘计为主技的武将）
    const SECRET_EFFECTS = [
      'aoe_damage', 'secret_unblockable', 'secret_rescue', 'secret_revive',
      'secret_aoe_fire', 'secret_aoe_burn', 'secret_aoe_force'
    ]
    if (SECRET_EFFECTS.includes(eff)) {
      return this.useSecretSkill(seat, { ...payload, skillEffect: eff })
    }

    if (eff === 'draw1') {
      if (seat.onceUsed.draw1) {
        this.warn('【英姿】本回合已用过。')
        return false
      }
      seat.onceUsed.draw1 = true
      this.drawCards(seat, 1)
      this.log(`${seat.label} 发动【${sk.name}】，摸一张牌。`, 'skill')
      return true
    }
    if (eff === 'balance') {
      if (seat.onceUsed.balance) {
        this.warn('【制衡】本回合已用过。')
        return false
      }
      const uids = payload.cardUids || []
      if (!uids.length) {
        this.warn('请先选择要弃置的手牌。')
        return false
      }
      seat.onceUsed.balance = true
      for (const uid of uids) {
        const card = seat.hand.find((c) => c.uid === uid)
        if (card) this.dropCard(seat, card)
      }
      this.drawCards(seat, uids.length)
      this.log(`${seat.label} 发动【${sk.name}】，弃 ${uids.length} 张换 ${uids.length} 张。`, 'skill')
      return true
    }
    if (eff === 'give_rende') {
      // 仁德：弃两张手牌给一名其他角色，自己回复 1 点体力
      if (seat.onceUsed.rende) {
        this.warn('【仁德】本回合已用过。')
        return false
      }
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || target.idx === seat.idx) {
        this.warn('请选择一名其他角色。')
        return false
      }
      const uids = payload.cardUids || []
      const cost = (uids.length >= 2 ? uids.slice(0, 2) : seat.hand.slice(0, 2).map((c) => c.uid))
        .map((u) => seat.hand.find((c) => c.uid === u))
        .filter(Boolean)
      if (cost.length < 2) {
        this.warn('【仁德】需两张手牌。')
        return false
      }
      seat.onceUsed.rende = true
      for (const c of cost) {
        this.removeHand(seat, c)
        target.hand.push(c)
      }
      if (seat.hp < seat.maxHp) seat.hp += 1
      this.log(`${seat.label} 发动【${sk.name}】，赠 ${target.label} 两张手牌，携民渡江，众望所归。`, 'skill')
      return true
    }
    if (eff === 'ban_slash') {
      // 挟天子：弃一张手牌，令一名其他角色下个用兵阶段不能出【击】
      if (seat.onceUsed.banSlash) {
        this.warn('【挟天子】本回合已用过。')
        return false
      }
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || target.idx === seat.idx) {
        this.warn('请选择一名其他角色。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌可弃。')
        return false
      }
      seat.onceUsed.banSlash = true
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      target.slashBanned = true
      this.log(`${seat.label} 发动【${sk.name}】，以朝廷诏命压制 ${target.label}，其下回合用兵不得出【击】。`, 'skill')
      return true
    }
    if (eff === 'star_gaze') {
      // 观星：弃一张手牌，摸一张牌并观看牌堆顶三张
      if (seat.onceUsed.star) {
        this.warn('【观星】本回合已用过。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌可弃。')
        return false
      }
      seat.onceUsed.star = true
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      this.drawCards(seat, 1)
      const top = this.state.deck.slice(0, 3)
      this.log(
        `${seat.label} 发动【${sk.name}】，夜观天象，来日之牌：${top.map((c) => `${cardName(c.key)}(${suitSymbol(c.suit)})`).join('、') || '牌堆已尽'}。`,
        'skill'
      )
      return true
    }
    if (eff === 'heal_ally') {
      // 联姻：弃两张手牌，与一名其他角色各回复 1 点体力
      if (seat.onceUsed.lianyin) {
        this.warn('【联姻】本回合已用过。')
        return false
      }
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || target.idx === seat.idx) {
        this.warn('请选择一名其他角色。')
        return false
      }
      const uids = payload.cardUids || []
      const cost = (uids.length >= 2 ? uids.slice(0, 2) : seat.hand.slice(0, 2).map((c) => c.uid))
        .map((u) => seat.hand.find((c) => c.uid === u))
        .filter(Boolean)
      if (cost.length < 2) {
        this.warn('【联姻】需两张手牌。')
        return false
      }
      seat.onceUsed.lianyin = true
      for (const c of cost) this.dropCard(seat, c)
      if (target.hp < target.maxHp) target.hp += 1
      if (seat.hp < seat.maxHp) seat.hp += 1
      this.log(`${seat.label} 发动【${sk.name}】，与 ${target.label} 结秦晋之好，双方各回复 1 点体力。`, 'skill')
      return true
    }
    if (eff === 'heal_skill') {
      // 青囊：弃一张手牌，令一名已受伤的角色回复 1 点体力（每回合两次）
      if ((seat.onceUsed.qingnang || 0) >= 2) {
        this.warn('【青囊】本回合已用两次。')
        return false
      }
      const target = this.state.seats[payload.targetIdx] || seat
      if (!target || !target.alive || target.hp >= target.maxHp) {
        this.warn('请选择一名已受伤的角色。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌可弃。')
        return false
      }
      seat.onceUsed.qingnang = (seat.onceUsed.qingnang || 0) + 1
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      target.hp = Math.min(target.maxHp, target.hp + 1)
      this.log(`${seat.label} 打开【${sk.name}】，妙手回春，${target.label} 回复 1 点体力。`, 'skill')
      return true
    }
    if (eff === 'duel_two') {
      // 离间：弃一张牌，令 A 对 B 出一张【击】，不出则 A 失去 1 点体力
      if (seat.onceUsed.lijian) {
        this.warn('【离间】本回合已用过。')
        return false
      }
      const a = this.state.seats[payload.targetIdx]
      const b = this.state.seats[payload.targetIdx2]
      if (!a || !b || !a.alive || !b.alive || a.idx === seat.idx || b.idx === seat.idx || a.idx === b.idx) {
        this.warn('请指定两名不同的其他角色。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌可弃。')
        return false
      }
      seat.onceUsed.lijian = true
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      this.log(`${seat.label} 发动【${sk.name}】，巧言令色，行连环美人计！`, 'skill')
      const slash = a.hand.find((c) => this.canBeSlash(a, c))
      if (slash) {
        this.removeHand(a, slash)
        this.log(`${a.label} 中计，被迫对 ${b.label} 出一记【击】。`, 'warn')
        await this.resolveSlash(a, b, slash)
      } else {
        this.log(`${a.label} 无【击】可出，怒火攻心，失去 1 点体力。`, 'hit')
        a.hp -= 1
        if (a.hp <= 0) await this.dying(a, seat)
      }
      return true
    }
    if (eff === 'steal_card' || eff === 'force_discard') {
      if (seat.hand.length < 1) {
        this.warn('手上无牌可弃。')
        return false
      }
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || target.idx === seat.idx) {
        this.warn('请选择一名其他角色。')
        return false
      }
      if (this.hasEffect(target, 'immune_steal')) {
        this.warn(`${target.label} 不受此技影响。`)
        return false
      }
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      if (!target.hand.length) {
        this.log(`${seat.label} 发动【${sk.name}】，然 ${target.label} 两手空空。`, 'skill')
        return true
      }
      const i = Math.floor(Math.random() * target.hand.length)
      const card = target.hand.splice(i, 1)[0]
      if (eff === 'steal_card') {
        seat.hand.push(card)
        this.log(`${seat.label} 发动【${sk.name}】，取得 ${target.label} 一张手牌。`, 'skill')
      } else {
        this.state.discard.push(card)
        this.log(`${seat.label} 发动【${sk.name}】，${target.label} 弃置一张手牌。`, 'skill')
      }
      return true
    }
    if (eff === 'slash_boost') {
      if (seat.onceUsed.boost) {
        this.warn('【裸衣】本回合已用过。')
        return false
      }
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      seat.boost = 1
      seat.onceUsed.boost = true
      this.log(`${seat.label} 发动【${sk.name}】，本回合【击】的创伤 +1。`, 'skill')
      return true
    }
    this.warn('此技无需主动发动。')
    return false
  }

  /**
   * 秘计：一局一次的大招。
   * 效果：aoe_damage 乱击 / secret_unblockable 单刀 / secret_rescue 单骑救主 /
   *       secret_revive 七星 / secret_aoe_fire 火烧赤壁 / secret_aoe_burn 夷陵 / secret_aoe_force 辕门射戟
   */
  async useSecretSkill(seat, payload = {}) {
    const eff = payload.skillEffect || (seat.hero.secret && seat.hero.secret.effect)
    if (!eff) {
      this.warn('此武将没有秘计。')
      return false
    }
    const sk = this.skillOf(seat, eff) || seat.hero.secret
    if (seat.secretUsed) {
      this.warn(`【${sk.name}】一局只能发动一次。`)
      return false
    }

    if (eff === 'aoe_damage') {
      if (seat.hand.length < 2) {
        this.warn('需弃两张手牌才能发动。')
        return false
      }
      seat.secretUsed = true
      const uids = (payload.cardUids || []).slice(0, 2)
      const cost = uids.length === 2 ? uids.map((u) => seat.hand.find((c) => c.uid === u)).filter(Boolean) : seat.hand.slice(0, 2)
      for (const c of cost) this.dropCard(seat, c)
      this.log(`${seat.label} 发动秘计【${sk.name}】，箭雨倾泻！`, 'skill')
      for (const other of this.state.seats) {
        if (other.alive && other.idx !== seat.idx) await this.damage(seat, other, 1, '乱击')
      }
      return true
    }
    if (eff === 'secret_unblockable') {
      // 单刀：弃一张牌，对范围内一名角色造成 1 点不可挡创伤
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || !this.inReach(seat, target)) {
        this.warn('请选择攻击范围内的一名角色。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌可弃。')
        return false
      }
      seat.secretUsed = true
      const cost = seat.hand.find((c) => c.uid === payload.cardUid) || seat.hand[0]
      this.dropCard(seat, cost)
      this.log(`${seat.label} 发动秘计【${sk.name}】，只身赴会，刀光无可回避！`, 'skill')
      await this.damage(seat, target, 1, '单刀')
      return true
    }
    if (eff === 'secret_rescue') {
      // 单骑救主：弃所有手牌，令一名其他角色回复 1 点体力并摸 2 张牌
      const target = this.state.seats[payload.targetIdx]
      if (!target || !target.alive || target.idx === seat.idx) {
        this.warn('请选择一名其他角色。')
        return false
      }
      if (!seat.hand.length) {
        this.warn('手上无牌，无法救主。')
        return false
      }
      seat.secretUsed = true
      const n = seat.hand.length
      for (const c of seat.hand.slice()) this.dropCard(seat, c)
      if (target.hp < target.maxHp) target.hp += 1
      this.drawCards(target, 2)
      this.log(`${seat.label} 发动秘计【${sk.name}】，弃 ${n} 张手牌，冲阵救出 ${target.label}！`, 'skill')
      return true
    }
    if (eff === 'secret_revive') {
      // 七星：体力不高于 1 时，弃所有牌，回复至 2 点并摸 2 张
      if (seat.hp > 1) {
        this.warn('【七星】只在体力不高于 1 点时方可禳星。')
        return false
      }
      seat.secretUsed = true
      for (const c of seat.hand.slice()) this.dropCard(seat, c)
      for (const slot of Object.keys(seat.equip)) {
        const eq = seat.equip[slot]
        if (eq) {
          this.state.discard.push(eq)
          this.onEquipLost(seat)
          seat.equip[slot] = null
        }
      }
      seat.hp = 2
      this.drawCards(seat, 2)
      this.log(`${seat.label} 发动秘计【${sk.name}】，七星灯禳命，气若游丝而复起！`, 'skill')
      return true
    }
    if (eff === 'secret_aoe_fire') {
      // 火烧赤壁：弃一张红色手牌，对至多两名其他角色各造成 1 点不可挡创伤
      const reds = seat.hand.filter((c) => isRedCard(c))
      if (!reds.length) {
        this.warn('需一张红色手牌。')
        return false
      }
      const idxs = (payload.targetIdxs || [payload.targetIdx, payload.targetIdx2]).filter((i) => i != null).slice(0, 2)
      const targets = idxs.map((i) => this.state.seats[i]).filter((t) => t && t.alive && t.idx !== seat.idx)
      if (!targets.length) {
        this.warn('请指定至多两名其他角色。')
        return false
      }
      seat.secretUsed = true
      const cost = reds.find((c) => c.uid === payload.cardUid) || reds[0]
      this.dropCard(seat, cost)
      this.log(`${seat.label} 发动秘计【${sk.name}】，东风既起，烈焰连船！`, 'skill')
      for (const t of targets) await this.damage(seat, t, 1, '火烧赤壁')
      return true
    }
    if (eff === 'secret_aoe_burn') {
      // 夷陵：弃所有红色手牌，对至多三名其他角色各 1 伤并弃其一张装备
      const reds = seat.hand.filter((c) => isRedCard(c))
      if (!reds.length) {
        this.warn('需红色手牌。')
        return false
      }
      const idxs = (payload.targetIdxs || [payload.targetIdx, payload.targetIdx2, payload.targetIdx3]).filter((i) => i != null).slice(0, 3)
      const targets = idxs.map((i) => this.state.seats[i]).filter((t) => t && t.alive && t.idx !== seat.idx)
      if (!targets.length) {
        this.warn('请指定至多三名其他角色。')
        return false
      }
      seat.secretUsed = true
      for (const c of reds) this.dropCard(seat, c)
      this.log(`${seat.label} 发动秘计【${sk.name}】，火烧连营七百里！`, 'skill')
      for (const t of targets) {
        await this.damage(seat, t, 1, '夷陵')
        if (t.alive) {
          const slots = Object.keys(t.equip).filter((s) => t.equip[s])
          if (slots.length) {
            const slot = slots[Math.floor(Math.random() * slots.length)]
            const eq = t.equip[slot]
            t.equip[slot] = null
            this.state.discard.push(eq)
            this.onEquipLost(t)
            this.log(`大火焚毁 ${t.label} 的【${cardName(eq.key)}】。`, 'warn')
          }
        }
      }
      return true
    }
    if (eff === 'secret_aoe_force') {
      // 辕门射戟：弃一张【击】，其余角色各弃一张手牌或受 1 点创伤
      const slash = seat.hand.find((c) => this.canBeSlash(seat, c))
      if (!slash) {
        this.warn('需一张【击】才能引弓立威。')
        return false
      }
      seat.secretUsed = true
      this.removeHand(seat, slash)
      this.state.discard.push(slash)
      this.log(`${seat.label} 发动秘计【${sk.name}】，一箭正中小支，诸将失色！`, 'skill')
      for (const other of this.state.seats) {
        if (!other.alive || other.idx === seat.idx) continue
        if (other.hand.length) {
          const i = Math.floor(Math.random() * other.hand.length)
          const card = other.hand.splice(i, 1)[0]
          this.state.discard.push(card)
          this.log(`${other.label} 慑于天威，弃置一张手牌。`, 'skill')
        } else {
          this.log(`${other.label} 无牌可弃，受 1 点创伤。`, 'hit')
          await this.damage(seat, other, 1, '辕门射戟')
        }
      }
      return true
    }
    this.warn('此秘计暂不可发动。')
    return false
  }

  /* ==================== 距离 ==================== */

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
  }

  attackReach(a) {
    let reach = 1
    if (a.equip.weapon) {
      const def = EQUIPS[a.equip.weapon.key]
      if (def && def.reach) reach = def.reach
    }
    if (this.hasEffect(a, 'reach_plus')) reach += 1
    return reach
  }

  inReach(a, b) {
    return this.distance(a, b) <= this.attackReach(a)
  }

  /** 可作为【击】目标的人 */
  slashTargets(seat) {
    return this.state.seats.filter(
      (t) => t.alive && t.idx !== seat.idx && this.inReach(seat, t) && !this.kongCheng(t)
    )
  }

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
  }

  kongCheng(seat) {
    return this.hasEffect(seat, 'kongcheng') && seat.hand.length === 0
  }

  nextSeat(seat) {
    const n = this.state.seats.length
    for (let i = 1; i <= n; i++) {
      const cand = this.state.seats[(seat.idx + i) % n]
      if (cand.alive) return cand
    }
    return null
  }

  /* ==================== 交互通道 ==================== */

  waitHuman() {
    return new Promise((resolve) => {
      this.humanResolve = resolve
    })
  }

  /** 玩家提交操作 */
  submit(action) {
    this.resolveWait(action)
  }

  resolveWait(action) {
    const r = this.humanResolve
    this.humanResolve = null
    if (r) r(action)
  }

  /** 玩家点「收兵」 */
  endPlayPhase() {
    if (this.state.stage !== 'play') return
    this.resolveWait({ type: 'endPlay' })
  }

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
  }

  /* ==================== 杂项 ==================== */

  async tick(seat, ms) {
    await wait(seat && seat.isAI && this.state.phase === 'playing' ? Math.min(ms, this.speed) : ms / 2)
  }

  log(text, tone) {
    this.state.log.push({ text, tone: tone || 'sys', round: this.state.round })
    if (this.state.log.length > 200) this.state.log.shift()
  }

  warn(text) {
    this.log(text, 'warn')
  }

  afterAction() {
    if (this.state.phase === 'playing') this.checkWin()
  }

  /** 退出游戏（清理异步等待） */
  destroy() {
    this.running = false
    this.resolveWait(null)
  }
}

export function createGame(heroes, opts) {
  return new Game(heroes, opts)
}
