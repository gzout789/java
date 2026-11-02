/**
 * 技能判定与发动（Game 的方法 mixin）
 * 包含：效果查询、能否当击、主动技 useSkill、秘计 useSecretSkill。
 */
import { cardName, suitSymbol, isRedCard } from '../rules.js'

export const skillMethods = {
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
  },

  /** 取拥有某效果的技能对象（用于日志取技能名） */
  skillOf(seat, effect) {
    const list = (seat && seat.hero.skills) || (seat && [seat.hero.skill]) || []
    return list.find(
      (s) => (Array.isArray(s.effect) ? s.effect.includes(effect) : s.effect === effect)
    )
  },

  canBeSlash(seat, card) {
    if (card.key === 'slash') return true
    if (this.hasEffect(seat, 'slash_any')) return true // 武圣：任意牌当击
    if (this.hasEffect(seat, 'slash_dodge_swap') && card.key === 'dodge') return true // 龙胆
    return false
  },

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
  },

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
  },

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
  },
}
