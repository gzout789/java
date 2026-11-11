/**
 * 烽烟三国 · 会盟讨董 —— 独立状态机
 *
 * 复用清单（来自既有身份杀牌引擎，未改一行）：
 *   rules.js      buildDeck / shuffle / CARDS / EQUIPS / 牌名 / 花色
 *   engine/deck.js deckMethods —— drawRaw / drawCards / dropCard / removeHand
 *   ai.js         aiPickDiscard —— 收兵弃牌优先级
 *   HERO_SKILLS   26 名武将池（经 constants.js 的 MODE_EFFECTS 做模式映射）
 *
 * 与身份杀牌的差异：没有身份、没有体力、没有距离与座位攻击；
 * 只有「手牌 → 兵种令 → 战功悬赏」和「轮末董卓事件」。
 */
import { buildDeck, shuffle } from '../../rules.js'
import { deckMethods } from '../../engine/deck.js'
import { aiPickDiscard } from '../../ai.js'
import {
  MODE, TROOPS, BOUNTY_TYPES, MERIT_RECIPE, DONG_EVENTS,
  MODE_EFFECTS, HERO_NAMES, counterOf
} from './constants.js'
import { claimCheck, needText, cardTroops } from './logic.js'
import { aiTakeTurn, aiShouldBlock } from './ai.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let meritSeq = 0
let logSeq = 0

const RIVAL_NAMES = ['袁本初', '公孙伯圭', '刘景升', '马寿成']

const FLAG_TEXT = {
  claim_cost: '揭榜须多付 1 令',
  draw_less: '各诸侯少摸 1 令',
  freeze_troop: '骑兵令暂不可用于揭榜'
}

function buildMeritDeck() {
  const deck = []
  for (const [key, count] of MERIT_RECIPE) {
    const def = BOUNTY_TYPES[key]
    for (let i = 0; i < count; i++) {
      deck.push({ uid: 'm' + ++meritSeq, key, name: def.name, need: { ...def.need }, bonus: def.bonus, flavor: def.flavor, gain: 1 })
    }
  }
  return shuffle(deck)
}

export function createHuimengGame(opts) {
  return new HuimengGame(opts)
}

export class HuimengGame {
  constructor({ seatCount = 3, playerName = '你', speed = 380 } = {}) {
    this.opts = { seatCount, playerName, speed }
    this.speed = speed
    this.destroyed = false
    this.state = {
      phase: 'setup', // setup | playing | over
      stage: 'claim', // claim | event | over
      seats: [],
      deck: [],
      discard: [],
      meritDeck: [],
      bounty: [],
      eventDeck: [],
      currentEvent: null,
      turnIdx: 0,
      round: 1,
      winner: null,
      logs: [],
      flags: { claimCost: 0, drawLess: 0, frozenTroop: null },
      lastClaim: null,
      busy: false
    }
  }

  /* deckMethods 依赖 this.state.deck / discard / seat.hand / this.log，结构完全兼容 */
  log(text, type = 'sys') {
    const s = this.state
    s.logs.unshift({ id: ++logSeq, text, type, round: s.round })
    if (s.logs.length > 160) s.logs.length = 160
  }

  /* ---------------- 开局 ---------------- */

  prepare(playerHero) {
    const s = this.state
    const n = Math.min(MODE.seatMax, Math.max(MODE.seatMin, this.opts.seatCount || 3))
    const pick = HERO_NAMES.includes(playerHero) ? playerHero : HERO_NAMES[0]
    const pool = [pick, ...shuffle(HERO_NAMES.filter((x) => x !== pick))]

    s.seats = []
    for (let i = 0; i < n; i++) {
      const hero = pool[i]
      s.seats.push({
        idx: i,
        name: i === 0 ? this.opts.playerName : RIVAL_NAMES[(i - 1) % RIVAL_NAMES.length],
        hero,
        effect: MODE_EFFECTS[hero] || null,
        isHuman: i === 0,
        hand: [],
        merit: 0,
        merits: [],
        boostUsed: 0
      })
    }

    s.deck = buildDeck()
    s.discard = []
    s.meritDeck = buildMeritDeck()
    s.eventDeck = shuffle(DONG_EVENTS.map((e) => ({ ...e })))
    s.bounty = []
    for (let i = 0; i < MODE.bountySlots; i++) s.bounty.push(this.drawMerit())
    s.currentEvent = null
    s.phase = 'playing'
    s.stage = 'claim'
    s.turnIdx = 0
    s.round = 1
    s.winner = null
    s.logs = []
    s.flags = { claimCost: 0, drawLess: 0, frozenTroop: null }
    s.lastClaim = null
    s.busy = false

    for (const seat of s.seats) this.drawCards(seat, MODE.startHand)
    this.log('关东诸侯会盟于酸枣，共讨董卓。各持 4 令，先积 5 战功者夺魁。', 'sys')
    this.log(`你的主将【${pick}】· ${MODE_EFFECTS[pick] ? MODE_EFFECTS[pick].name + '：' + MODE_EFFECTS[pick].desc : '无模式加成'}`, 'sys')
    this.log('揭榜：选中手牌 → 选一张战功悬赏 → 揭榜。兵种克制环 骑→步→盾→谋→骑。', 'sys')
    return s
  }

  drawMerit() {
    const s = this.state
    if (!s.meritDeck.length) {
      s.meritDeck = buildMeritDeck()
      this.log('战功簿用尽，重悬一轮战功牌。', 'sys')
    }
    return s.meritDeck.shift()
  }

  drawEvent() {
    const s = this.state
    if (!s.eventDeck.length) s.eventDeck = shuffle(DONG_EVENTS.map((e) => ({ ...e })))
    return s.eventDeck.shift()
  }

  beginTurn(seat) {
    const s = this.state
    const bonus = seat.effect && seat.effect.key === 'extra_draw' ? 1 : 0
    const n = Math.max(1, MODE.handDraw - (s.flags.drawLess || 0) + bonus)
    const got = this.drawCards(seat, n)
    this.log(`${seat.name} 征粮 ${got} 令。`, 'sys')
  }

  /* ---------------- 揭榜 ---------------- */

  claim(uids, bountyIdx) {
    const s = this.state
    if (s.phase !== 'playing' || s.stage !== 'claim') return { ok: false, msg: '当前不是揭榜阶段' }
    const seat = s.seats[s.turnIdx]
    const bounty = s.bounty[bountyIdx]
    if (!bounty) return { ok: false, msg: '请先选一张战功悬赏' }
    const uniq = Array.from(new Set(uids || []))
    if (!uniq.length) return { ok: false, msg: '请先选择要打出的手牌' }
    const cards = uniq.map((uid) => seat.hand.find((c) => c.uid === uid)).filter(Boolean)
    if (cards.length !== uniq.length) return { ok: false, msg: '手牌已变化，请重新选择' }

    const check = claimCheck(seat, cards, bounty, s.flags)
    if (!check.ok) {
      let msg = `兵种不合：需要 ${needText(seat, bounty, s.flags)}`
      if (check.missing.length) msg += `，还缺 ${check.missing.join('、')}`
      if (check.usable < check.totalNeed) msg += `；共需 ${check.totalNeed} 令，当前 ${check.usable} 令`
      return { ok: false, msg }
    }

    /* 【挡】拦截窗口：只有战功「严格低于」揭榜者的诸侯可拦截（追赶机制） */
    const blockers = []
    for (const other of s.seats) {
      if (other.idx === seat.idx || other.merit >= seat.merit) continue
      // 人类席位可在界面上开关「自动拦截」（默认开），不静默替玩家打出手牌
      if (other.isHuman && s.autoBlock === false) continue
      if (aiShouldBlock(this, other, seat)) blockers.push(other)
    }
    const payUids = uniq.slice()
    if (blockers.length && !(seat.effect && seat.effect.key === 'block_immune')) {
      const rest = seat.hand.find((c) => !payUids.includes(c.uid))
      for (const b of blockers) {
        const d = b.hand.find((c) => c.key === 'dodge')
        if (d) this.dropCard(b, d)
      }
      if (!rest) {
        this.log(`${blockers.map((b) => b.name).join('、')} 以【挡】拦截，${seat.name} 无余令可补，揭榜作废。`, 'warn')
        return { ok: false, msg: '遭落后诸侯【挡】拦截，且无余令可补，揭榜作废' }
      }
      payUids.push(rest.uid)
      this.log(`${blockers.map((b) => b.name).join('、')} 打出【挡】，${seat.name} 补付 1 令方得揭榜。`, 'warn')
    } else if (blockers.length) {
      this.log(`${seat.name} 主将【${seat.effect.name}】护主，他家【挡】拦截无效。`, 'sys')
    }

    for (const uid of payUids) {
      const c = seat.hand.find((x) => x.uid === uid)
      if (c) this.dropCard(seat, c)
    }
    const taken = s.bounty.splice(bountyIdx, 1)[0]
    seat.merits.push(taken)
    let gain = taken.gain || 1
    if (seat.effect && seat.effect.key === 'lagger_boost' && seat.boostUsed < 2 && !this.isLeader(seat)) {
      gain += 1
      seat.boostUsed++
      this.log(`${seat.name}【后进加功】发力，本次揭榜得 2 战功。`, 'sys')
    }
    seat.merit += gain
    s.bounty.splice(bountyIdx, 0, this.drawMerit())
    this.log(`${seat.name} 揭「${taken.name}」榜，付 ${payUids.length} 令，得 ${gain} 战功（共 ${seat.merit}）。`, 'claim')
    this.applyBountyBonus(seat, taken)
    if (seat.effect && seat.effect.key === 'aid_on_claim') this.drawCards(seat, 1)
    s.lastClaim = { seat: seat.idx, bounty: taken.key, gain }
    if (seat.merit >= MODE.winMerit && !s.winner) {
      this.log(`${seat.name} 已积满 ${MODE.winMerit} 战功，待轮末会盟裁定（期间仍可继续揭榜）。`, 'sys')
    }
    return { ok: true, gain, text: `揭「${taken.name}」成功，+${gain} 战功` }
  }

  applyBountyBonus(seat, taken) {
    const s = this.state
    if (taken.bonus === 'cut_leader') {
      const l = this.leader()
      if (l && l.idx !== seat.idx) {
        const n = this.discardN(l, 1)
        if (n) this.log(`「断粮」见效：${l.name} 弃 ${n} 令。`, 'claim')
      }
    } else if (taken.bonus === 'draw1') {
      this.drawCards(seat, 1)
      this.log(`「夺旗」见效：${seat.name} 额外摸 1 令。`, 'claim')
    } else if (taken.bonus === 'aid_lagger') {
      const g = this.lagger()
      if (g) {
        const n = this.drawCards(g, 1)
        this.log(`「救友」见效：${g.name} 摸 ${n} 令。`, 'claim')
      }
    }
  }

  /* ---------------- 排名工具 ---------------- */

  leader() {
    return this.state.seats.slice().sort((a, b) => b.merit - a.merit || a.idx - b.idx)[0] || null
  }
  lagger() {
    return this.state.seats.slice().sort((a, b) => a.merit - b.merit || b.idx - a.idx)[0] || null
  }
  isLeader(seat) {
    const l = this.leader()
    return !!l && l.idx === seat.idx && !this.state.seats.some((x) => x.idx !== seat.idx && x.merit >= seat.merit)
  }
  discardN(seat, n) {
    const picks = aiPickDiscard(seat, Math.min(n, seat.hand.length))
    for (const c of picks) this.dropCard(seat, c)
    return picks.length
  }
  trimHand(seat) {
    const over = seat.hand.length - MODE.maxHand
    if (over > 0) {
      const n = this.discardN(seat, over)
      if (n) this.log(`${seat.name} 收兵，弃 ${n} 张超上限手牌。`, 'sys')
    }
  }

  /* ---------------- 轮末：董卓事件 ---------------- */

  findCounterCard(seat, weakness) {
    const need = counterOf(weakness)
    if (!need) return null
    return seat.hand.find((c) => cardTroops(seat, c).includes(need)) || null
  }

  applyDiscardEvent(ev, seat, n) {
    if (seat.effect && seat.effect.key === 'event_immune') {
      this.log(`${seat.name} 主将【${seat.effect.name}】免疫「${ev.name}」。`, 'event')
      return
    }
    if (ev.weakness) {
      const card = this.findCounterCard(seat, ev.weakness)
      if (card) {
        this.dropCard(seat, card)
        const need = counterOf(ev.weakness)
        this.log(`${seat.name} 以${TROOPS[need].name}令化解「${ev.name}」。`, 'event')
        return
      }
    }
    const real = this.discardN(seat, n)
    if (real) this.log(`${seat.name} 受「${ev.name}」影响，弃 ${real} 令。`, 'event')
  }

  async resolveEvent() {
    const s = this.state
    s.stage = 'event'
    // 上一轮事件设的军令在本轮已生效，此处清空后再设新令（供下一轮）
    s.flags = { claimCost: 0, drawLess: 0, frozenTroop: null }
    const ev = this.drawEvent()
    s.currentEvent = ev
    this.log(`【董卓事件 · 第 ${s.round} 轮】${ev.name}：${ev.desc}`, 'event')
    const e = ev.effect

    if (e.type === 'claim_cost') {
      s.flags.claimCost = e.n
      this.log(`军令：${FLAG_TEXT.claim_cost}（下一轮生效）。`, 'event')
    } else if (e.type === 'draw_less') {
      s.flags.drawLess = e.n
      this.log(`军令：${FLAG_TEXT.draw_less}（下一轮生效）。`, 'event')
    } else if (e.type === 'freeze_troop') {
      s.flags.frozenTroop = e.troop
      this.log(`军令：${FLAG_TEXT.freeze_troop}（下一轮生效）。`, 'event')
    } else if (e.type === 'aid_lagger') {
      const g = this.lagger()
      if (g) this.log(`${g.name} 得时势补偿，摸 ${this.drawCards(g, e.n)} 令。`, 'event')
    } else if (e.type === 'discard_leader') {
      const l = this.leader()
      if (l) {
        const guard = l.effect && l.effect.key === 'leader_guard' ? 1 : 0
        this.applyDiscardEvent(ev, l, Math.max(0, e.n - guard))
      }
    } else if (e.type === 'discard_all') {
      for (const seat of s.seats) this.applyDiscardEvent(ev, seat, e.n)
    }

    await wait(this.speed)
    if (s.round > 50) {
      const l = this.leader()
      this.log('会盟日久，粮尽议和，按战功裁定。', 'sys')
      s.winner = { draw: false, idx: l.idx, text: `${l.name} 以 ${l.merit} 战功领盟` }
      s.phase = 'over'
      s.stage = 'over'
      return
    }
    this.checkWin()
  }

  /** 胜负只在事件阶段结束后裁定，避免中途抢跑引发争议 */
  checkWin() {
    const s = this.state
    const reached = s.seats.filter((x) => x.merit >= MODE.winMerit)
    if (!reached.length) return
    const max = Math.max(...reached.map((x) => x.merit))
    const tops = reached
      .filter((x) => x.merit === max)
      .slice()
      .sort((a, b) => b.hand.length - a.hand.length || a.idx - b.idx)
    if (tops.length > 1 && tops[0].hand.length === tops[1].hand.length) {
      s.winner = { draw: true, idx: tops[0].idx, text: `${tops.map((x) => x.name).join('、')} 战功相同，共举盟主` }
    } else {
      s.winner = { draw: false, idx: tops[0].idx, text: `${tops[0].name} 积 ${tops[0].merit} 战功，会盟夺魁` }
    }
    s.phase = 'over'
    s.stage = 'over'
    this.log(`【终局】${s.winner.text}`, 'win')
  }

  /* ---------------- 回合流转 ---------------- */

  async endTurn() {
    const s = this.state
    if (s.phase !== 'playing' || s.busy || s.turnIdx !== 0) return
    s.busy = true
    try {
      for (const seat of s.seats) this.trimHand(seat)
      for (let i = 1; i < s.seats.length; i++) {
        if (s.phase !== 'playing') break
        s.turnIdx = i
        s.stage = 'claim'
        this.beginTurn(s.seats[i])
        await wait(this.speed)
        await aiTakeTurn(this, s.seats[i])
      }
      if (s.phase !== 'playing') return
      await this.resolveEvent()
      if (s.phase !== 'playing') return
      s.round++
      s.turnIdx = 0
      s.stage = 'claim'
      this.beginTurn(s.seats[0])
      this.log(`—— 第 ${s.round} 轮 · 轮到你揭榜 ——`, 'sys')
    } finally {
      s.busy = false
    }
  }

  destroy() {
    this.destroyed = true
  }
}

/* 复用既有身份杀牌的牌堆操作（drawRaw / drawCards / dropCard / removeHand） */
Object.assign(HuimengGame.prototype, deckMethods)

export { TROOPS, MODE }
