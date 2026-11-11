/**
 * 会盟讨董 · 诸侯 AI
 *
 * 只做两件事：挑最划算的悬赏揭榜、落后时用【挡】拦截领先者。
 * 不读公共牌堆、不读事件堆顶（除主将【观星】给玩家的信息外），不作弊。
 */
import { findCardsFor } from './logic.js'
import { MODE } from './constants.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 落后诸侯是否打出一张【挡】拦截揭榜者 */
export function aiShouldBlock(game, seat, claimant) {
  if (!seat.hand.some((c) => c.key === 'dodge')) return false
  if (claimant.merit - seat.merit <= 0) return false
  const p = claimant.merit >= MODE.winMerit - 1 ? 0.85 : claimant.merit >= 2 ? 0.45 : 0.2
  return Math.random() < p
}

function bestClaim(game, seat) {
  const s = game.state
  const options = []
  for (let i = 0; i < s.bounty.length; i++) {
    const b = s.bounty[i]
    const uids = findCardsFor(seat, b, s.flags)
    if (!uids || !uids.length) continue
    let score = 10 - uids.length // 付令越少越划算
    if (b.bonus === 'draw1') score += 1
    const leader = game.leader()
    const lagger = game.lagger()
    if (b.bonus === 'cut_leader' && leader && leader.idx !== seat.idx) score += 2
    if (b.bonus === 'aid_lagger' && lagger && lagger.idx === seat.idx) score += 2
    if (seat.merit >= MODE.winMerit - 1) score += 5 // 临门一脚优先揭
    options.push({ uids, bountyIdx: i, score })
  }
  if (!options.length) return null
  options.sort((a, b) => b.score - a.score)
  return options[0]
}

/** AI 的一个揭榜阶段：最多揭 3 次，揭不动就收手留牌 */
export async function aiTakeTurn(game, seat) {
  for (let k = 0; k < 3; k++) {
    const s = game.state
    if (s.phase !== 'playing' || s.stage !== 'claim') return
    const pick = bestClaim(game, seat)
    if (!pick) break
    await wait(Math.round(game.speed * 0.7))
    const r = game.claim(pick.uids, pick.bountyIdx)
    if (!r.ok) break
  }
}
