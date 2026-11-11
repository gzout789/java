/**
 * 《烽烟三国·会盟讨董》对局引擎 v1.0
 *
 * 固定结算顺序（不得跳步）：
 *   出牌组合 → 克制链争抢 → 【挡】响应 → 战功入账 → 补榜 → 董卓事件 → 胜负判定 → 传令牌
 *
 * 采用同步状态机：引擎只改 state 与 pending，UI 读到 pending 后调用对应 action 推进。
 */
import {
  BASE_RECIPE, MERIT_RECIPE, EVENTS, HERO_EFFECTS,
  makeCards, shuffle, matchCombo, comboDominant, counters,
  cardLabel, meritName, TROOPS, TACTICS, RESPONSES
} from './rules.js'

const { floor, random } = Math
const pick = (arr) => arr[floor(random() * arr.length)]

export class HuimengEngine {
  constructor() {
    this.state = null
  }

  /* ==================== 初始化 ==================== */

  start(count = 4, hero = '赵云', humanName = '盟主') {
    count = Math.max(2, Math.min(5, count))
    const deck = shuffle(makeCards(BASE_RECIPE))
    const meritDeck = shuffle(makeCards(MERIT_RECIPE))
    const eventDeck = shuffle(EVENTS.slice())
    const aiNames = ['曹操', '关羽', '周瑜', '吕布', '诸葛亮'].filter((n) => n !== hero)
    const players = []
    for (let i = 0; i < count; i++) {
      players.push({
        idx: i,
        name: i === 0 ? humanName : `AI·${aiNames[(i - 1) % aiNames.length]}`,
        general: i === 0 ? hero : pick(Object.keys(HERO_EFFECTS)),
        effect: null,
        score: 0,
        hand: [],
        skillUsed: false,
        isHuman: i === 0
      })
    }
    players.forEach((p) => { p.effect = HERO_EFFECTS[p.general].key })

    this.state = {
      players, count, round: 1, leaderIdx: 0, actingIdx: 0, acted: [],
      phase: 'turn', deck, discard: [], meritDeck, eventDeck, eventDiscard: [],
      board: [], meritDiscard: [], pending: null, log: [], winner: null, currentEvent: null,
      banGuard: false, exhausted: false, target: 5, eventChain: false, reshuffles: 0
    }
    const s = this.state
    s.board = s.meritDeck.splice(0, count + 1)
    s.players.forEach((p) => this.draw(p.idx, 5))
    this.log(`会盟讨董开局：${count} 人，战功榜 ${s.board.length} 张，起始盟主 ${s.players[0].name}。`, 'sys')
    this.log(`目标战功 ${s.target}。胜负只在董卓事件结算后判定。`, 'sys')
    this.beginTurn()
    return s
  }

  /* ==================== 基础工具 ==================== */

  log(text, kind = 'sys') {
    this.state.log.push({ text, kind, round: this.state.round })
    if (this.state.log.length > 120) this.state.log.shift()
  }

  get handLimit() { return this.state.count === 5 ? 6 : 7 }
  get current() { return this.state.players[this.state.actingIdx] }
  get leader() { return this.state.players[this.state.leaderIdx] }

  draw(idx, n) {
    const s = this.state
    let got = 0
    for (let i = 0; i < n; i++) {
      if (!s.deck.length) {
        // 蓝图 2.6：耗尽且无法补充即终局；允许有限重洗（最多 2 次）保证短局节奏
        if (s.reshuffles < 2 && s.discard.length) {
          s.deck = shuffle(s.discard); s.discard = []; s.reshuffles++
          this.log('牌堆已尽，弃牌重洗（第 ' + s.reshuffles + ' 次）。', 'sys')
        } else { s.exhausted = true; break }
      }
      const c = s.deck.shift()
      if (c) { s.players[idx].hand.push(c); got++ }
    }
    return got
  }

  drop(idx, uids) {
    const s = this.state
    const hand = s.players[idx].hand
    const set = new Set(uids)
    const removed = hand.filter((c) => set.has(c.uid))
    s.players[idx].hand = hand.filter((c) => !set.has(c.uid))
    s.discard.push(...removed)
    return removed
  }

  enforceLimit(idx) {
    const p = this.state.players[idx]
    if (p.hand.length <= this.handLimit) return
    const excess = p.hand.length - this.handLimit
    // 优先弃战功无关牌：保留【击】与兵种
    const order = p.hand.slice().sort((a, b) => {
      const keep = (c) => (c.key === 'slash' ? 0 : TROOPS[c.key] ? 1 : 2)
      return keep(b) - keep(a)
    })
    this.drop(idx, order.slice(0, excess).map((c) => c.uid))
    this.log(`${p.name} 手牌超出上限，弃至 ${this.handLimit} 张。`, 'sys')
  }

  meritIdxByName(name) {
    return this.state.board.findIndex((c) => c.key === name)
  }

  refillBoard() {
    const s = this.state
    const need = s.count + 1 - s.board.length
    for (let i = 0; i < need; i++) {
      if (!s.meritDeck.length) {
        if (s.reshuffles < 2 && s.meritDiscard.length) {
          s.meritDeck = shuffle(s.meritDiscard); s.meritDiscard = []; s.reshuffles++
          this.log('战功牌堆已尽，弃置战功牌重洗。', 'sys')
        } else { s.exhausted = true; break }
      }
      const c = s.meritDeck.shift()
      if (c) s.board.push(c)
    }
  }

  /* ==================== 组合检索 ==================== */

  /** 组合判定（含赵云「少一张牌」单牌兑换） */
  matchForPlayer(player, cards) {
    const m = matchCombo(cards, this.state.count)
    if (m || cards.length !== 1 || player.effect !== 'lessCard' || player.skillUsed) return m
    const k = cards[0].key
    if (k === 'slash') return { merit: '斩敌', dominant: 'cavalry' }
    if (k === 'stratagem' || k === 'fire') return { merit: '夺旗', dominant: 'scheme' }
    if (k === 'cutSupply') return { merit: '断粮', dominant: 'scheme' }
    if (k === 'heal' || k === 'guard') return { merit: '救友', dominant: 'shield' }
    return null
  }

  /** 枚举手牌中的合法组合（2 张；赵云秘技可用 1 张） */
  findCombos(player, boardNames = null) {
    const out = []
    const hand = player.hand
    const useOne = player.effect === 'lessCard' && !player.skillUsed
    const sizeList = useOne ? [1, 2] : [2]
    const names = boardNames || this.state.board.map((c) => c.key)
    const banned = (m, cards) => this.state.banGuard &&
      (m.merit === '救友' || cards.some((c) => c.key === 'guard'))
    for (const size of sizeList) {
      for (let i = 0; i < hand.length; i++) {
        if (size === 1) {
          const m = this.matchForPlayer(player, [hand[i]])
          if (m && m.merit && names.includes(m.merit) && !banned(m, [hand[i]])) out.push({ uids: [hand[i].uid], ...m, keys: [hand[i].key] })
          continue
        }
        for (let j = i + 1; j < hand.length; j++) {
          const cards = [hand[i], hand[j]]
          const m = this.matchForPlayer(player, cards)
          if (!m) continue
          if (m.merit && names.includes(m.merit) && !banned(m, cards)) out.push({ uids: cards.map((c) => c.uid), ...m, keys: cards.map((c) => c.key) })
        }
      }
    }
    return out
  }

  /** UI 调用：判断当前选中的牌是否合法 */
  checkSelection(uids) {
    const p = this.current
    const cards = p.hand.filter((c) => uids.includes(c.uid))
    const m = this.matchForPlayer(p, cards)
    if (!m || !m.merit) return { ok: false, why: '这些牌不能兑换任何战功' }
    if (this.state.board.findIndex((c) => c.key === m.merit) < 0) return { ok: false, why: `战功榜上没有【${m.merit}】` }
    if (this.state.banGuard && m.merit === '救友') return { ok: false, why: '联军离心：本轮禁用【救友】' }
    if (this.state.banGuard && cards.some((c) => c.key === 'guard')) return { ok: false, why: '联军离心：本轮禁用【援护】' }
    return { ok: true, ...m }
  }

  /* ==================== 回合流程 ==================== */

  beginTurn() {
    const s = this.state
    if (s.exhausted) return this.finish('牌堆耗尽')
    const next = s.players.find((p) => !s.acted.includes(p.idx))
    if (!next) return this.eventPhase()
    s.actingIdx = next.idx
    s.phase = 'turn'
    this.draw(next.idx, 2)
    this.enforceLimit(next.idx)
    const combos = this.findCombos(next)
    if (next.isHuman) {
      // 郭嘉：摸牌阶段看战功牌堆顶，自动置底不需的牌
      if (next.effect === 'peekMerit' && !next.skillUsed && s.meritDeck.length > 1) {
        s.skillUsedFlag = true
        const top = s.meritDeck[0]
        if (!s.board.some((c) => c.key === top.key)) {
          s.meritDeck.push(s.meritDeck.shift())
          this.log(`${next.name} 发动【料敌】，将战功牌堆顶【${top.key}】置于堆底。`, 'skill')
        }
        next.skillUsed = true
      }
      s.pending = { type: 'play', player: next.idx, combos: combos.map((c) => c.uids.join(',')) }
    } else {
      s.pending = null
      this.autoPlay(next)
    }
  }

  autoPlay(ai) {
    const s = this.state
    const combos = this.findCombos(ai)
    if (!combos.length) {
      const dropN = ai.hand.length > this.handLimit ? ai.hand.length - this.handLimit : 1
      this.drop(ai.idx, ai.hand.slice(0, dropN).map((c) => c.uid))
      this.log(`${ai.name} 无可用组合，弃 ${dropN} 张牌。`, 'sys')
      return this.finishTurn()
    }
    // 优先：战功榜上仍存在的、主导牌型能克制对手的、分数较低的对手会响应 — 简化为优先抢战功
    combos.sort((a, b) => {
      const rank = (m) => (m.merit === '斩敌' ? 0 : m.merit === '夺旗' ? 1 : m.merit === '救友' ? 2 : 3)
      return rank(a) - rank(b)
    })
    const best = combos[0]
    // 技能消耗统一交给 submitPlay 处理，提前置位会让单牌组合校验失败
    this.log(`${ai.name} 打出【${best.keys.map(cardLabel).join('+')}】兑换【${best.merit}】。`, 'play')
    this.submitPlay(ai.idx, best.uids, best.merit)
  }

  /** 玩家/AI 提交出牌组合；merit 为战功名（可选，自动推导） */
  submitPlay(playerIdx, uids, merit = null) {
    const s = this.state
    if (s.phase !== 'turn' || s.actingIdx !== playerIdx) return { ok: false, why: '当前不是该玩家的回合' }
    const p = s.players[playerIdx]
    const cards = p.hand.filter((c) => uids.includes(c.uid))
    const m = this.matchForPlayer(p, cards)
    if (!m || (!m.merit && !merit)) return { ok: false, why: '组合无效' }
    merit = merit || m.merit
    const boardIdx = this.meritIdxByName(merit)
    if (boardIdx < 0) return { ok: false, why: '战功牌不在榜上' }
    if (s.banGuard && merit === '救友') return { ok: false, why: '联军离心：本轮禁用救友' }
    if (uids.length === 1) p.skillUsed = true

    // 出牌组合：牌先离手入弃堆（争抢败方也消耗）
    const played = this.drop(playerIdx, uids)
    s.pending = null

    // 克制链争抢：AI 若有能克制该主导牌型的组合则争抢（每轮最多一次）
    const rival = s.players.find((r) => !r.isHuman && !s.acted.includes(r.idx) && r.idx !== playerIdx && !r.contestedThisRound
      && this.findCombos(r, [merit]).some((c) => counters(comboDominant(played), null) || counters(c.dominant, m.dominant)))
    if (rival) {
      rival.contestedThisRound = true
      const rc = this.findCombos(rival, [merit])[0]
      const rivalCards = rival.hand.filter((c) => rc.uids.includes(c.uid))
      this.drop(rival.idx, rc.uids)
      const mine = comboDominant(played)
      const theirs = comboDominant(rivalCards)
      let winner
      if (counters(theirs, mine)) winner = rival
      else if (counters(mine, theirs)) winner = p
      else {
        const dist = (x) => (x.idx - s.leaderIdx + s.count) % s.count
        winner = dist(p) <= dist(rival) ? p : rival
      }
      this.log(`${rival.name} 争抢【${merit}】：【${rivalCards.map((c) => cardLabel(c.key)).join('+')}】对【${played.map((c) => cardLabel(c.key)).join('+')}】，${winner.name} 胜出。`, 'warn')
      if (winner !== p) return this.finishTurn()
    }

    // 【挡】响应窗口：战功低于出牌者且持【挡】者可使其失效
    const eligible = s.players.filter((r) => r.score < p.score && r.hand.some((c) => c.key === 'dodge'))
    // 平衡：AI 并非见挡必出（否则领先者被永久压制，40 局里几乎无人达标）
    const aiDodge = Math.random() > 0.45 ? eligible.find((r) => !r.isHuman) : null
    if (aiDodge) {
      const c = aiDodge.hand.find((x) => x.key === 'dodge')
      this.drop(aiDodge.idx, [c.uid])
      this.log(`${aiDodge.name} 打出【挡】，${p.name} 的组合失效，【${merit}】留在榜上。`, 'good')
      // 周瑜：火攻/奇计额外翻战功牌（即使被挡，效果已触发）
      this.applyZhouyu(p, played)
      return this.finishTurn()
    }
    const humanDodge = eligible.find((r) => r.isHuman)
    if (humanDodge) {
      s.pending = { type: 'response', claimer: playerIdx, merit, combo: played.map((c) => c.key) }
      s.phase = 'response'
      this.log(`响应窗口：你战功 ${humanDodge.score} 低于 ${p.name} 的 ${p.score}，可出【挡】使其组合失效。`, 'warn')
      return { ok: true, needResponse: true }
    }
    return this.credit(playerIdx, merit, played)
  }

  /** 响应窗口提交：useDodge=true 出挡化解；false 放弃 */
  respond(useDodge) {
    const s = this.state
    if (s.pending?.type !== 'response') return { ok: false }
    const { claimer, merit, combo } = s.pending
    const p = s.players[claimer]
    s.pending = null
    s.phase = 'turn'
    if (useDodge) {
      const human = s.players[0]
      const c = human.hand.find((x) => x.key === 'dodge')
      if (c) {
        this.drop(0, [c.uid])
        this.log(`你打出【挡】，${p.name} 的组合失效，【${merit}】留在榜上。`, 'good')
        return this.finishTurn()
      }
    }
    const played = combo.map((k, i) => ({ uid: `played-${i}`, key: k }))
    return this.credit(claimer, merit, played)
  }

  /** 战功入账 → 补榜 → 周瑜效果 → 结束回合 */
  credit(playerIdx, merit, played) {
    const s = this.state
    const p = s.players[playerIdx]
    const idx = this.meritIdxByName(merit)
    if (idx >= 0) s.meritDiscard.push(s.board.splice(idx, 1)[0])
    p.score++
    this.log(`${p.name} 兑换【${merit}】成功，战功 +1（现 ${p.score}）。`, 'good')
    this.applyZhouyu(p, played)
    this.refillBoard()
    if (s.exhausted) return this.finish('战功牌堆耗尽')
    return this.finishTurn()
  }

  applyZhouyu(p, played) {
    if (p.effect !== 'extraMerit' || !this.state.meritDeck.length) return
    if (played.some((c) => c.key === 'fire' || c.key === 'stratagem')) {
      const s = this.state
      if (s.board.length >= s.count + 1) return // 战功榜已满，牌留在堆中
      const c = s.meritDeck.shift()
      if (c) { s.board.push(c); this.log(`${p.name} 发动【火计】，额外翻出【${c.key}】加入战功榜。`, 'skill') }
    }
  }

  finishTurn() {
    const s = this.state
    s.acted.push(s.actingIdx)
    s.players.forEach((p) => { p.contestedThisRound = false })
    if (s.exhausted) return this.finish('牌堆耗尽')
    if (s.acted.length >= s.count) return this.eventPhase()
    this.beginTurn()
    return { ok: true }
  }

  /* ==================== 董卓事件阶段 ==================== */

  eventPhase() {
    const s = this.state
    if (s.exhausted) return this.finish('牌堆耗尽')
    s.phase = 'event'
    s.banGuard = false // 联军离心只在触发后的下一轮生效，此处清旧
    const ev = s.eventDeck.shift() || pick(EVENTS)
    if (!s.eventDeck.length) { s.eventDeck = shuffle(s.eventDiscard); s.eventDiscard = [] }
    s.eventDiscard.push(ev)
    s.currentEvent = ev
    this.log(`【董卓事件】${ev.name}：${ev.desc}${ev.note ? '（' + ev.note + '）' : ''}`, 'event')
    if (ev.id === 'E09' && !s.eventChain) {
      s.eventChain = true
      this.log('增兵汜水关：额外结算一张事件。', 'event')
      return this.resolveEvent(pick(EVENTS), true)
    }
    return this.resolveEvent(ev)
  }

  /** 事件结算；humanChoice 由 UI 通过 chooseEvent() 回调 */
  resolveEvent(ev, chained = false) {
    const s = this.state
    const ps = s.players
    const lowest = () => ps.filter((p) => p.score === Math.min(...ps.map((x) => x.score)))
    const highest = () => ps.filter((p) => p.score === Math.max(...ps.map((x) => x.score)))
    const needChoice = (p) => p.isHuman && ev.choice && ev.choice !== 'challenge'

    switch (ev.id) {
      case 'E01': // 火烧洛阳
        if (ps.some(needChoice)) {
          s.pending = { type: 'event', event: ev, kind: 'dodge', target: 0 }
          return { ok: true, needEventChoice: true }
        }
        ps.forEach((p) => {
          if (p.effect === 'keepCard' && !p.skillUsed) { p.skillUsed = true; this.log(`${p.name} 发动【屯田】，保留 1 张手牌。`, 'skill'); return }
          if (!p.hand.length) { this.draw(p.idx, 1); return }
          const c = pick(p.hand); this.drop(p.idx, [c.uid])
        })
        break
      case 'E02': { // 吕布出阵
        const target = highest()[0]
        if (needChoice(target)) {
          s.pending = { type: 'event', event: ev, kind: 'dodgeOrHold', target: target.idx }
          return { ok: true, needEventChoice: true }
        }
        if (target.score > 0) { target.score--; this.log(`${target.name} 战功 -1（现 ${target.score}）。`, 'event') }
        break
      }
      case 'E03': // 迁都长安
        if (needChoice(this.leader)) {
          s.pending = { type: 'event', event: ev, kind: 'leaderMerit', target: this.leader.idx }
          return { ok: true, needEventChoice: true }
        }
        s.meritDiscard.push(...s.board); s.board = []; this.refillBoard()
        this.log('战功榜全部弃置并补满。', 'event')
        break
      case 'E04': { // 粮道被劫
        const t = ps.slice().sort((a, b) => b.hand.length - a.hand.length)[0]
        if (needChoice(t)) {
          s.pending = { type: 'event', event: ev, kind: 'cutSupply', target: t.idx }
          return { ok: true, needEventChoice: true }
        }
        this.drop(t.idx, t.hand.slice(0, 2).map((c) => c.uid))
        this.log(`${t.name} 手牌最多，弃 2 张。`, 'event')
        break
      }
      case 'E05': { // 虎牢关挑战
        const human = ps[0]
        if (human.hand.some((c) => TROOPS[c.key])) {
          s.pending = { type: 'challenge', event: ev }
          return { ok: true, needChallenge: true }
        }
        return this.resolveChallenge(null)
      }
      case 'E06': // 联军离心
        s.banGuard = true
        this.log('本轮禁用【救友】组合与【援护】。', 'event')
        break
      case 'E07': // 赏罚失序（并列均生效）
        lowest().forEach((p) => { p.score++; this.log(`${p.name} 战功 +1（赏）。`, 'event') })
        highest().forEach((p) => { p.score = Math.max(0, p.score - 1); this.log(`${p.name} 战功 -1（罚）。`, 'event') })
        break
      case 'E08': { // 流言四起
        const t = ps.filter((p) => !p.isHuman).sort((a, b) => b.score - a.score)[0] || ps[1]
        if (needChoice(t)) {
          s.pending = { type: 'event', event: ev, kind: 'dodge', target: t.idx }
          return { ok: true, needEventChoice: true }
        }
        if (t.hand.length) { const c = pick(t.hand); this.drop(t.idx, [c.uid]); this.log(`${t.name} 弃 1 张手牌。`, 'event') }
        break
      }
      case 'E10': // 火烧粮仓
        ps.forEach((p) => {
          const troop = p.hand.find((c) => TROOPS[c.key])
          if (troop) this.drop(p.idx, [troop.uid])
          else { p.score = Math.max(0, p.score - 1); this.log(`${p.name} 无兵种牌，战功 -1。`, 'event') }
        })
        break
      case 'E11': // 天子犒军
        lowest().forEach((p) => { this.draw(p.idx, 2); this.log(`${p.name} 摸 2 张牌。`, 'event') })
        break
      case 'E12': // 董卓迁怒
        this.leader.score = Math.max(0, this.leader.score - 1)
        ps.filter((p) => p.idx !== s.leaderIdx).forEach((p) => this.draw(p.idx, 1))
        this.log(`${this.leader.name} 战功 -1，其余各摸 1 张。`, 'event')
        break
      default: break
    }
    return this.afterEvent(chained)
  }

  /** UI 选择事件应对：mitigate=true 使用化解方式 */
  chooseEvent(mitigate) {
    const s = this.state
    const pend = s.pending
    if (pend?.type !== 'event') return { ok: false }
    const ev = pend.event
    const p = s.players[pend.target]
    s.pending = null
    if (mitigate) {
      if (pend.kind === 'leaderMerit') {
        p.score = Math.max(0, p.score - 1)
        this.log(`${p.name} 弃 1 战功取消【迁都长安】。`, 'skill')
        return this.afterEvent(false)
      }
      const key = pend.kind === 'cutSupply' ? 'cutSupply' : 'dodge'
      const c = p.hand.find((x) => x.key === key)
      if (c) {
        this.drop(p.idx, [c.uid])
        this.log(`${p.name} 打出【${cardLabel(key)}】化解【${ev.name}】。`, 'good')
        return this.afterEvent(false)
      }
    }
    // 未化解：按事件原效果结算（复用 resolveEvent 的非交互分支）
    s.pending = null
    const forced = { ...ev, choice: null }
    // 避免 E01/E08 再次弹出（此时玩家已选择承受）
    return this.resolveEvent(forced)
  }

  /** 虎牢关挑战：传入玩家选中的兵种 uid（null=不参与） */
  resolveChallenge(uid) {
    const s = this.state
    const ps = s.players
    const human = ps[0]
    const entries = []
    if (uid) {
      const c = human.hand.find((x) => x.uid === uid)
      if (c) { this.drop(0, [c.uid]); entries.push({ p: human, key: c.key }) }
    }
    ps.filter((p) => !p.isHuman).forEach((p) => {
      const c = p.hand.find((x) => TROOPS[x.key])
      if (c) { this.drop(p.idx, [c.uid]); entries.push({ p, key: c.key }) }
    })
    if (!entries.length) { this.log('无人参与虎牢关挑战。', 'event'); return this.afterEvent(false) }
    // 张辽：兵种视为克制所有
    const rank = (e) => e.p.effect === 'challengeAll' ? 99 : { cavalry: 3, infantry: 2, shield: 1 }[e.key] || 0
    entries.sort((a, b) => rank(b) - rank(a))
    const top = rank(entries[0])
    const winners = entries.filter((e) => rank(e) === top)
    if (winners.length === 1) {
      winners[0].p.score++
      this.log(`${winners[0].p.name} 虎牢关胜出，战功 +1。`, 'event')
    } else this.log('虎牢关平局，无人得分。', 'event')
    return this.afterEvent(false)
  }

  afterEvent(chained) {
    const s = this.state
    s.currentEvent = null
    s.eventChain = false
    if (chained) return this.afterEvent(false)
    if (s.exhausted) return this.finish('牌堆耗尽')
    // 胜负判定（只在事件阶段结束后）
    const winner = this.judge()
    if (winner) return this.finish(winner.name)
    // 传令牌（顺时针）
    s.leaderIdx = (s.leaderIdx + 1) % s.count
    s.round++
    s.acted = []
    s.players.forEach((p) => { p.contestedThisRound = false; p.skillUsed = false })
    this.log(`第 ${s.round} 轮开始，盟主令牌传给 ${this.leader.name}。`, 'sys')
    this.beginTurn()
    return { ok: true }
  }

  /** 平局裁定：战功 → 手牌【击】数 → 座次靠近盟主 */
  /** 统一排序：战功 → 手牌【击】数 → 座次靠近盟主 */
  rankPlayers(list) {
    const s = this.state
    const dist = (p) => (p.idx - s.leaderIdx + s.count) % s.count
    return (list || s.players).slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const as = a.hand.filter((c) => c.key === 'slash').length
      const bs = b.hand.filter((c) => c.key === 'slash').length
      if (bs !== as) return bs - as
      return dist(a) - dist(b)
    })
  }

  judge() {
    const s = this.state
    const qual = s.players.filter((p) => p.score >= s.target)
    if (!qual.length) return null
    return this.rankPlayers(qual)[0]
  }

  finish(reason) {
    const s = this.state
    s.phase = 'over'
    s.pending = null
    const top = this.rankPlayers()[0]
    s.winner = {
      name: /耗尽/.test(reason) ? `${top.name}（牌堆耗尽，战功领先）` : reason,
      scores: s.players.map((p) => ({ name: p.name, general: p.general, score: p.score }))
    }
    this.log(`对局结束：${reason}。`, 'sys')
    return { ok: true, over: true }
  }
}

export default HuimengEngine
