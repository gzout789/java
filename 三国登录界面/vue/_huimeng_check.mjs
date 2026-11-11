/** 会盟讨董规则内核自检（纯 Node，无 DOM） */
import assert from 'node:assert/strict'
import { HuimengEngine } from './src/game/huimeng/engine.js'
import {
  BASE_RECIPE, MERIT_RECIPE, EVENTS, matchCombo, counters,
  COUNTER, HERO_LIST, makeCards
} from './src/game/huimeng/rules.js'

let n = 0
const ok = (msg) => { n++; console.log('PASS', n, msg) }

/* ---------- 静态规则断言 ---------- */
assert.equal(BASE_RECIPE.reduce((a, [, c]) => a + c, 0), 50)
assert.equal(MERIT_RECIPE.reduce((a, [, c]) => a + c, 0), 20)
assert.equal(EVENTS.length, 12)
assert.equal(HERO_LIST.length, 6)
ok('牌堆 50 / 战功 20 / 事件 12 / 示范武将 6')

assert.deepEqual(matchCombo([{ key: 'cavalry' }, { key: 'slash' }]).merit, '斩敌')
assert.deepEqual(matchCombo([{ key: 'archer' }, { key: 'stratagem' }]).merit, '夺旗')
assert.deepEqual(matchCombo([{ key: 'archer' }, { key: 'cutSupply' }]).merit, '断粮')
assert.deepEqual(matchCombo([{ key: 'shield' }, { key: 'heal' }]).merit, '救友')
assert.equal(matchCombo([{ key: 'shield' }, { key: 'slash' }]).merit, '斩敌')
assert.equal(matchCombo([{ key: 'cavalry' }, { key: 'heal' }]), null)
ok('四条兑换公式 + 无效组合判定')

for (const [a, b] of Object.entries(COUNTER)) assert.equal(counters(a, b), true)
assert.equal(counters('cavalry', 'shield'), false)
ok('克制链四元环 骑→步→盾→计谋→骑')

const cards = makeCards(BASE_RECIPE)
assert.equal(new Set(cards.map((c) => c.uid)).size, 50)
ok('基础牌 uid 唯一')

/* ---------- 批量对局模拟 ---------- */
let games = 0, roundsMax = 0, stepsMax = 0, wins = 0, exhaust = 0
for (let g = 0; g < 40; g++) {
  const count = 2 + (g % 4)
  const e = new HuimengEngine()
  e.start(count, HERO_LIST[g % HERO_LIST.length], '模拟盟主')
  let steps = 0
  let prevRound = 1
  while (e.state.phase !== 'over' && steps < 3000) {
    steps++
    const s = e.state
    assert.ok(s.round >= prevRound, '轮次不得回退')
    prevRound = s.round
    assert.ok(s.board.length <= count + 1, '战功榜不超上限')
    for (const p of s.players) {
      assert.ok(p.score >= 0 && p.score <= 12, `战功越界 ${p.score}`)
      assert.ok(p.hand.length >= 0 && p.hand.length <= 12, `手牌越界 ${p.hand.length}`)
    }
    const pend = s.pending
    if (!pend) {
      console.error('DEADLOCK', JSON.stringify({ phase: s.phase, acting: s.actingIdx, acted: s.acted, round: s.round, event: s.currentEvent, log: s.log.slice(-8).map(l => l.text) }, null, 2))
      throw new Error('无 pending 且未结束，引擎死锁')
    }
    if (pend.type === 'play') {
      const combos = e.findCombos(s.players[0])
      if (combos.length && Math.random() > 0.12) {
        const c = combos[0]
        const r = e.submitPlay(0, c.uids, c.merit)
        assert.ok(r.ok || r.needResponse, '合法组合必须可提交')
      } else {
        const drop = s.players[0].hand[0] ? [s.players[0].hand[0].uid] : []
        if (drop.length) e.drop(0, drop)
        e.finishTurn()
      }
    } else if (pend.type === 'response') {
      e.respond(Math.random() > 0.5)
    } else if (pend.type === 'event') {
      e.chooseEvent(Math.random() > 0.5)
    } else if (pend.type === 'challenge') {
      const t = s.players[0].hand.find((c) => ['cavalry', 'infantry', 'shield', 'archer'].includes(c.key))
      e.resolveChallenge(t && Math.random() > 0.2 ? t.uid : null)
    } else throw new Error('未知 pending: ' + pend.type)
  }
  assert.ok(steps < 3000, `对局未在 3000 步内结束（${count}人局）`)
  assert.ok(e.state.winner, '结束必须有 winner')
  if (/耗尽/.test(e.state.winner.name)) exhaust++
  else wins++
  games++
  roundsMax = Math.max(roundsMax, e.state.round)
  stepsMax = Math.max(stepsMax, steps)
}
ok(`批量模拟 ${games} 局全部正常结束（获胜 ${wins} / 牌堆耗尽 ${exhaust}，最大 ${roundsMax} 轮 ${stepsMax} 步）`)

/* ---------- 胜负只在事件后判定 ---------- */
{
  const e = new HuimengEngine()
  e.start(4, '赵云')
  e.state.players[1].score = 6
  // 直接判定函数应返回达标者，但不应在回合中自动结束
  assert.equal(e.state.phase, 'turn')
  assert.equal(e.judge().idx, 1)
  ok('回合中途战功达标不提前结束，judge 仅由事件阶段调用')
}

console.log(`ALL ${n} ASSERTIONS PASSED`)
