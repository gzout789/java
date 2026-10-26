/**
 * 烽烟三国杀 · AI 托管
 *
 * 设计原则：AI 只知道自己的身份和明置的汉主，其余人的身份靠行为推断
 * （谁打过汉主、谁打过自己），不作弊读暗置身份，这样对局才有博弈感。
 */
import { EQUIPS, CARDS } from './rules.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function lordSeat(game) {
  return game.state.seats.find((s) => s.role === 'lord')
}

/** 被 other 攻击过的次数 */
function hitBy(game, other, victimIdx) {
  return (other.marks && other.marks[victimIdx]) || 0
}

/**
 * 威胁度：越大越值得打
 * 打过汉主 → 群雄嫌疑；打过自己 → 敌意明确；残血 → 优先补刀
 */
function threat(game, seat, other) {
  const lord = lordSeat(game)
  let score = 0
  score += hitBy(game, other, seat.idx) * 2
  if (lord) {
    score += hitBy(game, other, lord.idx) * 3
    if (seat.role === 'rebel' && other.role === 'lord') score += 8
    if (seat.role === 'loyal' && other.idx === lord.idx) score -= 100
    if (seat.role === 'lord' && other.role === 'loyal') score -= 100
  }
  // 残血优先补刀
  score += (other.maxHp - other.hp) * 0.8
  // 隐客后期要清场，但不先动汉主
  if (seat.role === 'spy') {
    const alive = game.state.seats.filter((s) => s.alive).length
    if (alive <= 3 && other.role === 'lord') score -= 6
    if (other.role === 'loyal') score += 1
  }
  return score
}

/** 排出攻击优先级（从高到低） */
function rankTargets(game, seat) {
  return game.state.seats
    .filter((t) => t.alive && t.idx !== seat.idx)
    .slice()
    .sort((a, b) => threat(game, seat, b) - threat(game, seat, a))
}

/* ==================== 回合出牌 ==================== */

export async function aiPlayTurn(game, seat) {
  for (let i = 0; i < 14; i++) {
    if (game.state.phase !== 'playing' || !seat.alive) return
    const action = decideAction(game, seat)
    if (!action) break
    await wait(game.speed)
    await action()
    if (game.state.phase !== 'playing') return
  }
}

/** 决定下一步动作，没有可做之事返回 null */
function decideAction(game, seat) {
  const hand = seat.hand

  // 1. 装备（武器 > 马 > 甲胄）
  const equipCard = hand.find((c) => EQUIPS[c.key])
  if (equipCard) {
    const def = EQUIPS[equipCard.key]
    const cur = seat.equip[def.slot]
    const better =
      !cur ||
      (def.reach && (!EQUIPS[cur.key] || (EQUIPS[cur.key].reach || 0) < def.reach))
    if (better) {
      return async () => {
        await game.useCard(seat, equipCard, seat.idx)
      }
    }
  }

  // 2. 主动技
  const skill = skillAction(game, seat)
  if (skill) return skill

  // 3. 出【击】（只在能打中优先目标时）
  const canSlash =
    seat.slashCount < (1 + (game.hasEffect(seat, 'extra_slash') ? 1 : 0)) &&
    !(seat.trapEffects && seat.trapEffects.skipSlash)
  if (canSlash) {
    const targets = game.slashTargets(seat)
    if (targets.length) {
      const ordered = rankTargets(game, seat).filter((t) => targets.includes(t))
      const victim = ordered[0]
      const card = hand.find((c) => game.canBeSlash(seat, c))
      if (victim && card) {
        return async () => {
          await game.useCard(seat, card, victim.idx)
        }
      }
    }
  }

  // 4. 回血（自己或汉主）
  if (seat.hp <= seat.maxHp - 2) {
    const heal = hand.find((c) => c.key === 'heal')
    if (heal) {
      return async () => {
        await game.useCard(seat, heal, seat.idx)
      }
    }
  }
  const lord = lordSeat(game)
  if (lord && lord.alive && lord.hp <= 1 && (seat.role === 'loyal' || seat.role === 'lord')) {
    const heal = hand.find((c) => c.key === 'heal')
    if (heal) {
      return async () => {
        await game.useCard(seat, heal, lord.idx)
      }
    }
  }

  // 5. 广纳
  const draw2 = hand.find((c) => c.key === 'draw2')
  if (draw2) {
    return async () => {
      await game.useCard(seat, draw2, seat.idx)
    }
  }

  // 6. 探囊 / 奇袭
  const stealCards = hand.filter((c) => c.key === 'steal' || game.usableAs(seat, c).includes('steal'))
  if (stealCards.length) {
    const targets = game.schemeTargets(seat, 'steal')
    if (targets.length) {
      const victim = rankTargets(game, seat).find((t) => targets.includes(t))
      if (victim) {
        const card = stealCards[0]
        return async () => {
          await game.useCard(seat, card, victim.idx, card.key === 'steal' ? undefined : 'steal')
        }
      }
    }
  }

  // 7. 惑敌
  const duel = hand.find((c) => c.key === 'duel')
  if (duel) {
    const targets = game.schemeTargets(seat, 'duel')
    const victim = rankTargets(game, seat).find((t) => targets.includes(t))
    if (victim) {
      return async () => {
        await game.useCard(seat, duel, victim.idx)
      }
    }
  }

  // 8. 延时计略
  for (const key of ['trapSlash', 'trapDraw', 'trapBolt']) {
    const card = hand.find((c) => c.key === key)
    if (!card) continue
    const targets = game.schemeTargets(seat, key)
    const victim = rankTargets(game, seat).find(
      (t) => targets.includes(t) && !t.traps.some((tc) => tc.key === key)
    )
    if (victim) {
      return async () => {
        await game.useCard(seat, card, victim.idx)
      }
    }
  }

  return null
}

function skillAction(game, seat) {
  const skills = seat.hero.skills || [seat.hero.skill]
  for (const s of skills) {
    if (Array.isArray(s.effect)) continue // 常策数组不主动
    const action = aiActiveSkill(game, seat, s.effect)
    if (action) return action
  }
  // 秘计单独考虑（一局一次，场面合适才放）
  const secret = seat.hero.secret
  if (secret && !seat.secretUsed && !Array.isArray(secret.effect)) {
    const action = aiSecretSkill(game, seat, secret.effect)
    if (action) return action
  }
  return null
}

/** 单个主动技的 AI 判断 */
function aiActiveSkill(game, seat, eff) {
  const enemies = rankTargets(game, seat)
  const lord = lordSeat(game)

  if (eff === 'draw1' && !seat.onceUsed.draw1 && seat.hand.length < 4) {
    return async () => {
      await game.useSkill(seat, { skillEffect: eff })
    }
  }

  if (eff === 'slash_boost' && !seat.onceUsed.boost && seat.hand.length >= 2) {
    const hasSlash = seat.hand.some((c) => game.canBeSlash(seat, c))
    if (hasSlash) {
      const cost = seat.hand.find((c) => c.key !== 'slash' && c.key !== 'dodge') || seat.hand[0]
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, cardUid: cost.uid })
      }
    }
  }

  if (eff === 'steal_card' || eff === 'force_discard') {
    const targets = game.state.seats.filter((t) => t.alive && t.idx !== seat.idx && t.hand.length)
    const victim = enemies.find((t) => targets.includes(t))
    if (victim && seat.hand.length >= 2) {
      const cost = seat.hand.find((c) => c.key !== 'dodge') || seat.hand[0]
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: victim.idx, cardUid: cost.uid })
      }
    }
  }

  if (eff === 'balance' && !seat.onceUsed.balance && seat.hand.length >= 2) {
    // 手牌里没有能用的牌才换
    const useful = seat.hand.filter((c) => c.key === 'slash' || c.key === 'dodge' || c.key === 'heal')
    if (useful.length === 0) {
      const uids = seat.hand.slice(0, Math.min(2, seat.hand.length)).map((c) => c.uid)
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, cardUids: uids })
      }
    }
  }

  // 挟天子：压制威胁最高的敌人
  if (eff === 'ban_slash' && !seat.onceUsed.banSlash && seat.hand.length >= 2) {
    const victim = enemies[0]
    if (victim) {
      const cost = seat.hand.find((c) => c.key !== 'slash' && c.key !== 'dodge') || seat.hand[0]
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: victim.idx, cardUid: cost.uid })
      }
    }
  }

  // 仁德：手牌富余时优先济主公
  if (eff === 'give_rende' && !seat.onceUsed.rende && seat.hand.length >= 4) {
    const donee = lord && lord.alive && lord.idx !== seat.idx ? lord : null
    if (donee) {
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: donee.idx, cardUids: seat.hand.slice(0, 2).map((c) => c.uid) })
      }
    }
  }

  // 观星：手牌多时换牌知天时
  if (eff === 'star_gaze' && !seat.onceUsed.star && seat.hand.length >= 3) {
    const cost = seat.hand.find((c) => c.key !== 'slash' && c.key !== 'dodge' && c.key !== 'heal') || seat.hand[0]
    return async () => {
      await game.useSkill(seat, { skillEffect: eff, cardUid: cost.uid })
    }
  }

  // 联姻：自己受伤时，与一名其他角色各回一口
  if (eff === 'heal_ally' && !seat.onceUsed.lianyin && seat.hand.length >= 2 && seat.hp < seat.maxHp) {
    const partner = game.state.seats.find((t) => t.alive && t.idx !== seat.idx)
    if (partner) {
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: partner.idx, cardUids: seat.hand.slice(0, 2).map((c) => c.uid) })
      }
    }
  }

  // 青囊：优先救受伤的汉主，其次自己
  if (eff === 'heal_skill' && (seat.onceUsed.qingnang || 0) < 2 && seat.hand.length >= 2) {
    const patient =
      lord && lord.alive && lord.idx !== seat.idx && lord.hp < lord.maxHp ? lord : seat.hp < seat.maxHp ? seat : null
    if (patient) {
      const cost = seat.hand.find((c) => c.key !== 'heal' && c.key !== 'dodge') || seat.hand[0]
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: patient.idx, cardUid: cost.uid })
      }
    }
  }

  // 离间：令两个敌人自相残杀
  if (eff === 'duel_two' && !seat.onceUsed.lijian && seat.hand.length >= 3) {
    const a = enemies[0]
    const b = enemies[1]
    if (a && b) {
      const cost = seat.hand.find((c) => c.key !== 'slash' && c.key !== 'dodge') || seat.hand[0]
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, targetIdx: a.idx, targetIdx2: b.idx, cardUid: cost.uid })
      }
    }
  }

  return null
}

/** 秘计的 AI 判断（一局一次，选时机） */
function aiSecretSkill(game, seat, eff) {
  const enemies = rankTargets(game, seat)

  if (eff === 'aoe_damage' && !seat.secretUsed && seat.hand.length >= 4) {
    const alive = game.state.seats.filter((s) => s.alive).length
    if (alive <= 4) {
      return async () => {
        await game.useSkill(seat, { skillEffect: eff, cardUids: seat.hand.slice(0, 2).map((c) => c.uid) })
      }
    }
  }
  if (eff === 'secret_unblockable') {
    const victim = enemies.find((t) => game.inReach(seat, t))
    if (victim && seat.hand.length >= 1) {
      const cost = seat.hand.find((c) => c.key !== 'dodge' && c.key !== 'heal') || seat.hand[0]
      return async () => {
        await game.useSecretSkill(seat, { skillEffect: eff, targetIdx: victim.idx, cardUid: cost.uid })
      }
    }
  }
  if (eff === 'secret_aoe_fire') {
    const hasRed = seat.hand.some((c) => ['heart', 'diamond'].includes(c.suit))
    if (hasRed && enemies.length >= 2) {
      return async () => {
        await game.useSecretSkill(seat, { skillEffect: eff, targetIdx: enemies[0].idx, targetIdx2: enemies[1].idx })
      }
    }
  }
  if (eff === 'secret_aoe_burn') {
    const hasRed = seat.hand.some((c) => ['heart', 'diamond'].includes(c.suit))
    if (hasRed && enemies.length >= 2 && seat.hand.length >= 3) {
      const t = enemies.slice(0, 3).map((x) => x.idx)
      return async () => {
        await game.useSecretSkill(seat, { skillEffect: eff, targetIdx: t[0], targetIdx2: t[1], targetIdx3: t[2] })
      }
    }
  }
  if (eff === 'secret_aoe_force') {
    const alive = game.state.seats.filter((s) => s.alive && s.idx !== seat.idx).length
    if (alive >= 2 && seat.hand.some((c) => game.canBeSlash(seat, c)) && seat.hand.length >= 2) {
      return async () => {
        await game.useSecretSkill(seat, { skillEffect: eff })
      }
    }
  }
  if (eff === 'secret_revive' && seat.hp <= 1 && (seat.hand.length || Object.values(seat.equip).some(Boolean))) {
    return async () => {
      await game.useSecretSkill(seat, { skillEffect: eff })
    }
  }
  // secret_rescue（单骑救主）AI 暂不使用，留给玩家绝境翻盘
  return null
}

/* ==================== 响应 ==================== */

/** 被【击】时是否出【挡】 */
export function aiAskDodge(game, seat, source) {
  const opts = seat.hand.filter((c) => game.canBeDodge(seat, c))
  if (!opts.length) return null
  // 优先用【击】当【挡】（赵云龙胆）时保留真【挡】——这里简单取第一张
  if (seat.hp <= 2) return opts[0]
  if (seat.hand.length >= 3) return opts[0]
  // 吕布无双要多留一张挡
  if (game.hasEffect(source, 'double_dodge') && opts.length >= 2) return opts[0]
  return Math.random() < 0.65 ? opts[0] : null
}

/** 是否出【援】救人 */
export function aiAskSave(game, saver, target) {
  const lord = lordSeat(game)
  // 忠良、汉主之间互相救
  if (lord && target.idx === lord.idx && saver.role !== 'rebel') return true
  if (saver.role === 'lord' && target.role === 'loyal') return true
  // 群雄救「打过汉主的同伙」
  if (saver.role === 'rebel' && lord && hitBy(game, target, lord.idx) > 0) return true
  // 隐客前期保汉主，后期不救
  if (saver.role === 'spy') {
    const alive = game.state.seats.filter((s) => s.alive).length
    if (lord && target.idx === lord.idx && alive > 2) return true
    return false
  }
  return false
}

/** 是否用【缓策】抵消 */
export function aiAskNegate(game, seat, user, schemeKey, target) {
  const harmfulToMe = target && target.idx === seat.idx
  // 指向自己的延时计略一定化解
  if (harmfulToMe && ['trapSlash', 'trapDraw', 'trapBolt', 'steal', 'duel'].includes(schemeKey)) {
    return true
  }
  const lord = lordSeat(game)
  if (lord && target && target.idx === lord.idx && seat.role === 'loyal') {
    return ['trapSlash', 'trapDraw', 'trapBolt', 'duel'].includes(schemeKey)
  }
  // 群雄看到有人对同伙不利也帮一把
  if (seat.role === 'rebel' && target && lord && hitBy(game, target, lord.idx) > 0) {
    return ['trapBolt', 'duel'].includes(schemeKey)
  }
  return false
}

/** 收兵阶段弃牌：优先弃用不上的 */
export function aiPickDiscard(seat, count) {
  const value = (c) => {
    if (c.key === 'dodge') return 1
    if (c.key === 'heal') return 2
    if (c.key === 'slash') return 3
    if (EQUIPS[c.key]) return 1
    if (CARDS[c.key] && CARDS[c.key].kind === 'scheme') return 2
    return 2
  }
  return seat.hand.slice().sort((a, b) => value(a) - value(b)).slice(0, count)
}
