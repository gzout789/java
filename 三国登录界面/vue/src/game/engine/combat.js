/**
 * 出牌与战斗结算（Game 的方法 mixin）
 * 包含：使用手牌、装备、击杀/闪避、探囊、惑敌、缓策、枭姬、反间。
 */
import { CARDS, EQUIPS, isEquip, isRedCard, cardName } from '../rules.js'
import { aiAskDodge, aiAskNegate } from '../ai.js'

export const combatMethods = {
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
  },

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
  },

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
  },

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
  },

  /** 询问目标是否出【挡】 */
  async askDodge(source, target) {
    const options = target.hand.filter((c) => this.canBeDodge(target, c))
    if (!options.length) return null
    if (target.isAI) {
      const pick = aiAskDodge(this, target, source)
      if (pick) this.removeHand(target, pick)
      return pick
    }
    const tok = this.pushPending({
      kind: 'dodge',
      idx: target.idx,
      from: source.idx,
      text: `${source.label} 对你使用【击】，是否出【挡】？`
    })
    const action = await this.waitHuman()
    this.clearPending(tok)
    if (action && action.type === 'dodge') {
      const card = target.hand.find((c) => c.uid === action.cardUid)
      if (card) {
        this.removeHand(target, card)
        return card
      }
    }
    return null
  },

  canBeDodge(seat, card) {
    if (card.key === 'dodge') return true
    return this.hasEffect(seat, 'slash_dodge_swap') && card.key === 'slash'
  },

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
  },

  /** 枭姬：失去装备区一张牌后摸两张 */
  onEquipLost(seat) {
    if (this.hasEffect(seat, 'equip_lost_draw2')) {
      const sk = this.skillOf(seat, 'equip_lost_draw2')
      this.drawCards(seat, 2)
      this.log(`${seat.label} 发动【${sk.name}】，武备虽失，战意更盛，摸两张牌。`, 'skill')
    }
  },

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
          const tok = this.pushPending({
            kind: 'duel',
            idx: turn.idx,
            text: `惑敌未决：是否出一张【击】？不出则受 1 点创伤。`
          })
          const action = await this.waitHuman()
          this.clearPending(tok)
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
  },

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
        const tok = this.pushPending({
          kind: 'negate',
          idx: seat.idx,
          text: `${user.label} 使用【${CARDS[schemeKey].name}】${harmful ? '指向你' : ''}，是否以【缓策】化解？`
        })
        const action = await this.waitHuman()
        this.clearPending(tok)
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
  },
}
