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
  buildDeck, isEquip, judgeResult, shuffle, cardName
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
      const judgeCard = drawn[0]
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

  async discardPhase(seat) {
    const over = seat.hand.length - seat.hp
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
        target.hp++
        this.state.discard.push(card)
        this.log(`${seat.label} 对 ${target.label} 施【援】，回复 1 点体力。`, 'good')
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
    if (old) this.state.discard.push(old)
    seat.equip[def.slot] = card
    this.log(`${seat.label} 装备【${def.name}】——${def.desc}。`, 'skill')
    this.afterAction()
  }

  async resolveSlash(source, target, card) {
    this.log(`${source.label} 对 ${target.label} 挥出一记【击】。`, 'hit')
    source.marks[target.idx] = (source.marks[target.idx] || 0) + 1
    const need = this.hasEffect(source, 'double_dodge') ? 2 : 1
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
    }
  }

  async resolveDuel(source, target) {
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
    target.hp -= amount
    this.log(`${target.label} 受到 ${amount} 点创伤（${cause || '交锋'}），剩余 ${Math.max(target.hp, 0)} 点体力。`, 'hit')

    // 受伤触发的应策
    const eff = target.hero.skill.effect
    if (eff === 'hurt_draw1') {
      this.drawCards(target, 1)
      this.log(`${target.label} 发动【${target.hero.skill.name}】，摸一张牌。`, 'skill')
    } else if (eff === 'hurt_draw2') {
      this.drawCards(target, 2)
      this.log(`${target.label} 发动【${target.hero.skill.name}】，摸两张牌。`, 'skill')
    } else if (eff === 'hurt_steal' && source && source.hand.length) {
      const i = Math.floor(Math.random() * source.hand.length)
      const card = source.hand.splice(i, 1)[0]
      target.hand.push(card)
      this.log(`${target.label} 发动【${target.hero.skill.name}】，取得 ${source.label} 一张手牌。`, 'skill')
    } else if (eff === 'retaliate' && source && source.alive) {
      this.log(`${target.label} 发动【${target.hero.skill.name}】，反噬 ${source.label}。`, 'skill')
      source.hp -= 1
      if (source.hp <= 0) await this.dying(source, target)
    }

    // 造成击杀伤害后的抽牌（太史慈·神射）
    if (source && cause === 'slash' && source.hero.skill.effect === 'slash_draw') {
      this.drawCards(source, 1)
      this.log(`${source.label} 的【${source.hero.skill.name}】生效，箭无虚发，摸一张牌。`, 'skill')
    }

    if (target.hp <= 0) {
      await this.dying(target, source)
    }
    this.afterAction()
  }

  /** 濒死：依次询问求援 */
  async dying(target, source) {
    this.log(`${target.label} 气血将尽，命悬一线！`, 'death')
    const n = this.state.seats.length
    for (let i = 0; i < n; i++) {
      const saver = this.state.seats[(target.idx + i) % n]
      // 濒死之人救不了自己，从下家开始依次询问
      if (!saver.alive || saver.idx === target.idx) continue
      const heal = saver.hand.find((c) => c.key === 'heal')
      if (!heal) continue
      let use = false
      if (saver.isAI) {
        use = aiAskSave(this, saver, target)
        if (use) {
          const card = saver.hand.find((c) => c.key === 'heal')
          this.removeHand(saver, card)
          this.state.discard.push(card)
          target.hp = 1
          this.log(`${saver.label} 以【援】救下 ${target.label}，体力回到 1 点。`, 'good')
          return true
        }
      } else {
        this.state.pending = {
          kind: 'save',
          idx: saver.idx,
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
            this.log(`你以【援】救下 ${target.label}，体力回到 1 点。`, 'good')
            return true
          }
        }
      }
    }
    await this.death(target, source)
    return false
  }

  async death(target, killer) {
    target.alive = false
    target.roleOpen = true
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

  hasEffect(seat, effect) {
    return !!seat && seat.alive && seat.hero.skill.effect === effect
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

  /** 玩家/AI 发动主动技 */
  async useSkill(seat, payload = {}) {
    const eff = seat.hero.skill.effect
    if (eff === 'draw1') {
      if (seat.onceUsed.draw1) {
        this.warn('【英姿】本回合已用过。')
        return false
      }
      seat.onceUsed.draw1 = true
      this.drawCards(seat, 1)
      this.log(`${seat.label} 发动【${seat.hero.skill.name}】，摸一张牌。`, 'skill')
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
      this.log(`${seat.label} 发动【${seat.hero.skill.name}】，弃 ${uids.length} 张换 ${uids.length} 张。`, 'skill')
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
        this.log(`${seat.label} 发动【${seat.hero.skill.name}】，然 ${target.label} 两手空空。`, 'skill')
        return true
      }
      const i = Math.floor(Math.random() * target.hand.length)
      const card = target.hand.splice(i, 1)[0]
      if (eff === 'steal_card') {
        seat.hand.push(card)
        this.log(`${seat.label} 发动【${seat.hero.skill.name}】，取得 ${target.label} 一张手牌。`, 'skill')
      } else {
        this.state.discard.push(card)
        this.log(`${seat.label} 发动【${seat.hero.skill.name}】，${target.label} 弃置一张手牌。`, 'skill')
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
      this.log(`${seat.label} 发动【${seat.hero.skill.name}】，本回合【击】的创伤 +1。`, 'skill')
      return true
    }
    if (eff === 'aoe_damage') {
      if (seat.secretUsed) {
        this.warn('【乱击】一局只能发动一次。')
        return false
      }
      if (seat.hand.length < 2) {
        this.warn('需弃两张手牌才能发动。')
        return false
      }
      seat.secretUsed = true
      const uids = (payload.cardUids || []).slice(0, 2)
      const cost = uids.length === 2 ? uids.map((u) => seat.hand.find((c) => c.uid === u)).filter(Boolean) : seat.hand.slice(0, 2)
      for (const c of cost) this.dropCard(seat, c)
      this.log(`${seat.label} 发动秘计【${seat.hero.skill.name}】，箭雨倾泻！`, 'skill')
      for (const other of this.state.seats) {
        if (other.alive && other.idx !== seat.idx) await this.damage(seat, other, 1, '乱击')
      }
      return true
    }
    this.warn('此技无需主动发动。')
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
