/**
 * 会盟讨董 · 模式层结算纯函数
 * engine.js 与 ai.js 共用同一套「揭榜匹配」判定，避免裁判与 AI 各算各的。
 */
import { BOUNTY_TYPES, TROOPS, troopOf } from './constants.js'

/** 武将模式效果能否把本兵种当万能牌 */
function isWild(seat, troop) {
  const eff = seat.effect && seat.effect.key
  return (eff === 'scheme_wild' && troop === 'scheme') ||
    (eff === 'equip_wild' && troop === 'equip')
}

/** 一张牌在本模式里可充当的兵种集合 */
export function cardTroops(seat, card) {
  const t = troopOf(card)
  if (!t) return []
  if (isWild(seat, t)) return ['cavalry', 'infantry', 'shield', 'scheme', 'equip']
  return [t]
}

/** 计算某个悬赏实际需要付几张什么令（含主将减免与事件加码） */
export function effectiveNeed(seat, bounty, flags = {}) {
  const def = BOUNTY_TYPES[bounty.key] || bounty
  const need = { ...(def.need || {}) }
  const eff = seat.effect && seat.effect.key
  if (eff === 'discount') {
    const k = Object.keys(need).find((x) => need[x] >= 2) || Object.keys(need)[0]
    if (k) need[k] = Math.max(1, need[k] - 1)
  }
  const extra = Math.max(0, flags.claimCost || 0)
  return { need, extra }
}

function usableCard(seat, card, frozen) {
  const ts = cardTroops(seat, card)
  if (!ts.length) return null
  if (frozen && ts.length === 1 && ts[0] === frozen) return null
  return ts
}

/**
 * 校验一组手牌能否揭某张悬赏。
 * 返回 { ok, missing, need, extra, usable, totalNeed }，UI 用它给出提示。
 */
export function claimCheck(seat, cards, bounty, flags = {}) {
  const { need, extra } = effectiveNeed(seat, bounty, flags)
  const frozen = flags.frozenTroop
  const pool = []
  for (const c of cards) {
    const ts = usableCard(seat, c, frozen)
    if (ts) pool.push(ts)
  }
  const remain = { ...need }
  // 固定兵种牌先分配，万能牌后补，避免万能牌抢占稀缺兵种
  const order = pool.slice().sort((a, b) => a.length - b.length)
  for (const ts of order) {
    const cand = Object.keys(remain).filter((t) => remain[t] > 0 && ts.includes(t))
    if (!cand.length) continue
    cand.sort((a, b) => remain[b] - remain[a] || a.localeCompare(b))
    remain[cand[0]]--
  }
  const missing = []
  for (const [t, n] of Object.entries(remain)) {
    if (n > 0) missing.push(`${TROOPS[t] ? TROOPS[t].name : t}×${n}`)
  }
  const totalNeed = Object.values(need).reduce((a, b) => a + b, 0) + extra
  return {
    ok: missing.length === 0 && pool.length >= totalNeed,
    missing,
    need,
    extra,
    usable: pool.length,
    totalNeed
  }
}

/** AI 用：从手牌里贪心挑出一组满足悬赏的 uid */
export function findCardsFor(seat, bounty, flags = {}) {
  const { need, extra } = effectiveNeed(seat, bounty, flags)
  const frozen = flags.frozenTroop
  const hand = seat.hand.slice()
  const picked = []
  const take = (pred) => {
    const candidates = hand
      .map((c, i) => ({ c, i }))
      .filter((x) => usableCard(seat, x.c, frozen) && pred(x.c))
      .sort((a, b) => cardTroops(seat, a.c).length - cardTroops(seat, b.c).length)
    if (!candidates.length) return null
    const { c, i } = candidates[0]
    hand.splice(i, 1)
    picked.push(c.uid)
    return c
  }
  for (const [t, n] of Object.entries(need)) {
    for (let k = 0; k < n; k++) {
      if (!take((c) => cardTroops(seat, c).includes(t))) return null
    }
  }
  for (let k = 0; k < extra; k++) {
    if (!take(() => true)) return null
  }
  return picked
}

/** 悬赏需求的可读文案，如「骑兵×2」 */
export function needText(seat, bounty, flags = {}) {
  const { need, extra } = effectiveNeed(seat, bounty, flags)
  const parts = Object.entries(need).map(
    ([t, n]) => `${TROOPS[t] ? TROOPS[t].short : t}×${n}`
  )
  if (extra) parts.push(`任意×${extra}`)
  return parts.join(' + ')
}
