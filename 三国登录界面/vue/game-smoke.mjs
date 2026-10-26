/**
 * 引擎冒烟测试：自动托管玩家（一直弃权/结束回合），让 AI 座位互相打完一整局。
 * 用法：node game-smoke.mjs [局数]
 * 通过标准：任意一局能打完（phase=over）且无未捕获异常；多局可覆盖更多武将与技能。
 */
import { readFileSync } from 'node:fs'
import { createGame } from './src/game/engine.js'
import { toGameHero } from './src/game/rules.js'

const ROUNDS = Number(process.argv[2] || 5)

process.on('unhandledRejection', (e) => {
  console.error('未捕获异常:', e)
  process.exit(1)
})

const raw = JSON.parse(readFileSync('./smoke-heroes.json', 'utf-8')).data
const heroes = raw.map(toGameHero)
console.log(`英雄池 ${heroes.length} 名，连续对局 ${ROUNDS} 场`)

let skillHits = 0

function runOne(i) {
  return new Promise((resolve, reject) => {
    const g = createGame(heroes, { seatCount: 5, playerName: '冒烟', speed: 1 })
    const before = g.log.bind(g)
    g.log = (text, tone) => {
      if (tone === 'skill') skillHits++
      before(text, tone)
    }
    const cands = g.prepare()
    g.start(cands[i % cands.length].id)

    const timer = setInterval(() => {
      try {
        if (g.state.phase === 'over') {
          clearInterval(timer)
          resolve(g.state.winner && g.state.winner.text)
          return
        }
        if (g.state.pending) {
          g.submit(null)
        } else if (g.state.stage === 'play' && g.state.turnIdx === 0) {
          g.endPlayPhase()
        }
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, 2)

    setTimeout(() => {
      clearInterval(timer)
      if (g.state.phase === 'over') resolve(g.state.winner && g.state.winner.text)
      else reject(new Error(`第 ${i + 1} 局超时未打完（phase=${g.state.phase}, round=${g.state.round}）`))
    }, 120000)
  })
}

let ok = 0
for (let i = 0; i < ROUNDS; i++) {
  try {
    const text = await runOne(i)
    ok++
    console.log(`第 ${i + 1} 局打完：${text}`)
  } catch (e) {
    console.error(`第 ${i + 1} 局失败：`, e.message)
    process.exit(1)
  }
}
console.log(`\n冒烟通过：${ok}/${ROUNDS} 局完整打完，技能结算播报 ${skillHits} 次`)
