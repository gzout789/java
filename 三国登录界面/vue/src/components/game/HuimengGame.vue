<script setup>
/**
 * 《烽烟三国·会盟讨董》对局界面
 * 规则数据：src/game/huimeng/rules.js   引擎：src/game/huimeng/engine.js
 */
import { ref, computed } from 'vue'
import { HuimengEngine } from '../../game/huimeng/engine.js'
import {
  HERO_LIST, HERO_EFFECTS, MERIT_FORMULA, EVENTS,
  cardLabel, cardGroup, TROOPS, TACTICS, RESPONSES
} from '../../game/huimeng/rules.js'

const props = defineProps({ user: { type: Object, default: () => ({}) } })
const emit = defineEmits(['back'])

const engine = new HuimengEngine()
const s = ref(null)
const setup = ref(true)
const count = ref(4)
const hero = ref('赵云')
const selected = ref([])
const targetMerit = ref('')
const errMsg = ref('')
const revealRules = ref(false)

const phaseText = computed(() => {
  const p = s.value?.pending
  if (!p) return '对局进行中'
  return { play: '你的回合', response: '响应窗口', event: '董卓事件', challenge: '虎牢关挑战' }[p.type] || '对局进行中'
})
const mySeat = computed(() => s.value?.players[0])
const comboInfo = computed(() => {
  if (!s.value || s.value.pending?.type !== 'play') return { ok: false }
  return engine.checkSelection(selected.value)
})
const canPickMore = computed(() => {
  if (!s.value || s.value.pending?.type !== 'play') return false
  return selected.value.length < (mySeat.value?.effect === 'lessCard' && !mySeat.value?.skillUsed ? 1 : 2)
})
const handSorted = computed(() => {
  if (!s.value) return []
  const order = { troop: 0, tactic: 1, response: 2 }
  return mySeat.value.hand.slice().sort((a, b) => order[cardGroup(a.key)] - order[cardGroup(b.key)])
})
const lastLogs = computed(() => (s.value?.log || []).slice(-14).reverse())

function sync() {
  s.value = engine.state ? JSON.parse(JSON.stringify(engine.state)) : null
  errMsg.value = ''
}

function startGame() {
  engine.start(count.value, hero.value, props.user?.username || props.user?.name || '盟主')
  setup.value = false
  selected.value = []
  targetMerit.value = ''
  sync()
}

function back() {
  if (!setup.value) { setup.value = true; s.value = null; selected.value = [] }
  else emit('back')
}

function toggleCard(uid) {
  if (s.value?.pending?.type === 'challenge') { selected.value = [uid]; return }
  if (s.value?.pending?.type !== 'play') return
  if (selected.value.includes(uid)) selected.value = selected.value.filter((x) => x !== uid)
  else if (canPickMore.value) {
    selected.value = [...selected.value, uid]
    const r = engine.checkSelection(selected.value)
    if (r.ok) targetMerit.value = r.merit
  }
  errMsg.value = ''
}

function playCombo() {
  const r = engine.checkSelection(selected.value)
  if (!r.ok) { errMsg.value = r.why; return }
  engine.submitPlay(0, selected.value, targetMerit.value)
  selected.value = []
  sync()
}

function passTurn() {
  const drop = selected.value.length ? selected.value : (mySeat.value?.hand[0] ? [mySeat.value.hand[0].uid] : [])
  if (drop.length) engine.drop(0, drop)
  engine.log(`你无可用组合，弃 ${drop.length} 张牌。`, 'sys')
  engine.finishTurn()
  selected.value = []
  sync()
}

function doRespond(use) { engine.respond(use); sync() }
function doEvent(mitigate) { engine.chooseEvent(mitigate); sync() }
function doChallenge(uid) { engine.resolveChallenge(uid); selected.value = []; sync() }
function restart() { setup.value = true; s.value = null; selected.value = [] }

function eventKindText(kind) {
  return ({ dodge: '出【挡】化解', dodgeOrHold: '出【挡】或【盾兵+坚守】化解', leaderMerit: '弃 1 战功取消', cutSupply: '出【断粮计】反制' })[kind] || '化解'
}
</script>

<template>
  <div class="hm-root">
    <!-- ============ 开局设置 ============ -->
    <div v-if="setup" class="hm-setup">
      <div class="hm-setup-head">
        <div>
          <div class="hm-eyebrow">烽烟三国 · 首发模式</div>
          <h2 class="hm-title">会盟讨董</h2>
          <p class="hm-sub">2–5 人 · 5–8 分钟 · 竞速抢分 · 公共 BOSS 压力</p>
        </div>
        <button class="hm-btn ghost" @click="back">← 返回</button>
      </div>

      <div class="hm-setup-grid">
        <div class="hm-panel">
          <h3 class="hm-h3">一、人数</h3>
          <div class="hm-chips">
            <button v-for="n in [2, 3, 4, 5]" :key="n" class="hm-chip" :class="{ on: count === n }" @click="count = n">{{ n }} 人</button>
          </div>
          <p class="hm-hint">战功榜 {{ count + 1 }} 张 · 手牌上限 {{ count === 5 ? 6 : 7 }} · 目标 {{ 5 }} 战功</p>
          <p v-if="count === 2" class="hm-hint">2 人局：【救友】改称【自保】，效果相同。</p>

          <h3 class="hm-h3">二、主将</h3>
          <div class="hm-heroes">
            <button v-for="name in HERO_LIST" :key="name" class="hm-hero" :class="{ on: hero === name }" @click="hero = name">
              <b>{{ name }}</b>
              <span>{{ HERO_EFFECTS[name].name }} · {{ HERO_EFFECTS[name].desc }}</span>
            </button>
          </div>
        </div>

        <div class="hm-panel hm-rules">
          <h3 class="hm-h3">玩法速览</h3>
          <ol class="hm-steps">
            <li>每回合摸 2 张，打出 <b>1 个组合</b> 兑换战功榜上的战功牌。</li>
            <li>组合分四类：斩敌 / 夺旗 / 断粮 / 救友（见下方公式）。</li>
            <li>同回合争抢同一张时按 <b>骑→步→盾→计谋→骑</b> 裁定。</li>
            <li>战功低于你的人可出【挡】令你的组合失效——领先者会被压。</li>
            <li>全员行动后翻 1 张董卓事件，全服结算，随后传盟主令牌。</li>
            <li>事件结算后战功 ≥ 5 者获胜；中途达标不提前结束。</li>
          </ol>
          <button class="hm-link" @click="revealRules = !revealRules">{{ revealRules ? '收起' : '展开' }}组合公式</button>
          <div v-if="revealRules" class="hm-formulas">
            <div v-for="(v, k) in MERIT_FORMULA" :key="k" class="hm-formula"><b>{{ k }}</b><span>{{ v }}</span></div>
            <p class="hm-hint">每回合各限 1 次：谋士类战术牌可当任意战术牌；主将技能每局 1 次可当任意 1 张兵种牌。</p>
          </div>
          <button class="hm-btn primary big" @click="startGame">鸣鼓开战 ⚔</button>
        </div>
      </div>
    </div>

    <!-- ============ 对局 ============ -->
    <div v-else-if="s" class="hm-game">
      <div class="hm-topbar">
        <div class="hm-topinfo">
          <b>第 {{ s.round }} 轮</b>
          <span class="hm-sep">·</span>
          <span>{{ phaseText }}</span>
          <span class="hm-sep">·</span>
          <span>盟主：{{ s.players[s.leaderIdx].name }}</span>
          <span class="hm-sep">·</span>
          <span>目标战功 {{ s.target }}</span>
        </div>
        <div class="hm-topact">
          <span class="hm-piles">牌堆 {{ s.deck.length }} / 战功 {{ s.meritDeck.length }} / 事件 {{ s.eventDeck.length }}</span>
          <button class="hm-btn ghost small" @click="restart">重开</button>
          <button class="hm-btn ghost small" @click="back">离开</button>
        </div>
      </div>

      <!-- 座位区 -->
      <div class="hm-seats">
        <div v-for="p in s.players" :key="p.idx" class="hm-seat" :class="{ active: s.actingIdx === p.idx && s.phase === 'turn', leader: s.leaderIdx === p.idx }">
          <div class="hm-seat-top">
            <b>{{ p.name }}</b>
            <span v-if="s.leaderIdx === p.idx" class="hm-crown">盟主</span>
          </div>
          <div class="hm-general">{{ p.general }} · {{ HERO_EFFECTS[p.general]?.name }}</div>
          <div class="hm-score"><span>战功</span><b>{{ p.score }}</b></div>
          <div class="hm-handcount">手牌 {{ p.hand.length }}</div>
        </div>
      </div>

      <!-- 事件横幅 -->
      <div v-if="s.currentEvent" class="hm-event-banner">
        <b>【{{ s.currentEvent.name }}】</b> {{ s.currentEvent.desc }}
        <span v-if="s.currentEvent.note">（{{ s.currentEvent.note }}）</span>
      </div>

      <!-- 战功榜 -->
      <div class="hm-board">
        <div class="hm-board-title">战功榜 <small>({{ s.board.length }} 张)</small></div>
        <div class="hm-board-cards">
          <div v-for="(c, i) in s.board" :key="c.uid" class="hm-merit" :class="{ target: targetMerit === c.key && comboInfo.ok }">
            <b>{{ c.key }}</b><small>{{ MERIT_FORMULA[c.key] }}</small>
          </div>
        </div>
      </div>

      <div class="hm-main">
        <div class="hm-left">
          <!-- 响应窗口 -->
          <div v-if="s.pending?.type === 'response'" class="hm-pending hm-alert">
            <h3>响应窗口 · 【挡】</h3>
            <p>你战功 {{ mySeat.score }}，低于出牌者。可出【挡】使其组合失效，战功牌留在榜上。</p>
            <div class="hm-actions">
              <button class="hm-btn primary" @click="doRespond(true)">出【挡】化解</button>
              <button class="hm-btn ghost" @click="doRespond(false)">不出，继续结算</button>
            </div>
          </div>

          <!-- 事件抉择 -->
          <div v-else-if="s.pending?.type === 'event'" class="hm-pending hm-event">
            <h3>董卓事件 · {{ s.pending.event.name }}</h3>
            <p>{{ s.pending.event.desc }}</p>
            <p class="hm-hint">{{ s.pending.event.note }}</p>
            <div class="hm-actions">
              <button class="hm-btn primary" @click="doEvent(true)">{{ eventKindText(s.pending.kind) }}</button>
              <button class="hm-btn ghost" @click="doEvent(false)">承受效果</button>
            </div>
          </div>

          <!-- 虎牢关 -->
          <div v-else-if="s.pending?.type === 'challenge'" class="hm-pending hm-challenge">
            <h3>虎牢关挑战</h3>
            <p>选 1 张兵种牌应战（按克制链比大小，胜者 +1 战功）。</p>
            <div class="hm-hand">
              <button v-for="c in mySeat.hand.filter(x => TROOPS[x.key])" :key="c.uid" class="hm-card troop" :class="{ pick: selected.includes(c.uid) }" @click="toggleCard(c.uid)">
                <b>{{ cardLabel(c.key) }}</b>
              </button>
            </div>
            <div class="hm-actions">
              <button class="hm-btn primary" :disabled="!selected.length" @click="doChallenge(selected[0])">出战</button>
              <button class="hm-btn ghost" @click="doChallenge(null)">不参与</button>
            </div>
          </div>

          <!-- 出牌 -->
          <template v-else-if="s.pending?.type === 'play'">
            <div class="hm-hand-head">
              <b>你的手牌</b>
              <span>选 1–2 张组成兑换组合{{ mySeat.effect === 'lessCard' && !mySeat.skillUsed ? '（单骑：可只选 1 张）' : '' }}</span>
            </div>
            <div class="hm-hand">
              <button v-for="c in handSorted" :key="c.uid" class="hm-card" :class="[cardGroup(c.key), { pick: selected.includes(c.uid) }]" @click="toggleCard(c.uid)">
                <b>{{ cardLabel(c.key) }}</b>
                <small>{{ cardGroup(c.key) === 'troop' ? '兵种' : cardGroup(c.key) === 'tactic' ? '战术' : '响应' }}</small>
              </button>
            </div>
            <div class="hm-combo-bar">
              <template v-if="comboInfo.ok">
                <span class="hm-ok">✓ {{ comboInfo.merit }} · 主导 {{ comboInfo.dominant === 'scheme' ? '计谋' : cardLabel(comboInfo.dominant) }}</span>
                <label>兑换目标
                  <select v-model="targetMerit">
                    <option v-for="c in s.board.filter(x => x.key === comboInfo.merit)" :key="c.uid" :value="c.key">{{ c.key }}</option>
                  </select>
                </label>
                <button class="hm-btn primary" @click="playCombo">打出兑换</button>
              </template>
              <template v-else>
                <span class="hm-why">{{ selected.length ? comboInfo.why || '再选一张牌组成组合' : '点击手牌选择组合' }}</span>
                <button class="hm-btn ghost" @click="passTurn">弃牌过</button>
              </template>
              <span v-if="errMsg" class="hm-err">{{ errMsg }}</span>
            </div>
          </template>

          <div v-else class="hm-wait">AI 行动中……</div>

          <!-- 对局结束 -->
          <div v-if="s.phase === 'over'" class="hm-over">
            <h2>🏆 {{ s.winner.name }}</h2>
            <div v-for="p in s.winner.scores" :key="p.name" class="hm-over-row"><span>{{ p.name }}（{{ p.general }}）</span><b>{{ p.score }} 战功</b></div>
            <button class="hm-btn primary" @click="restart">再战一局</button>
          </div>
        </div>

        <div class="hm-right">
          <div class="hm-log-title">战况</div>
          <div class="hm-log">
            <div v-for="(l, i) in lastLogs" :key="i" class="hm-log-line" :class="'k-' + l.kind"><span>R{{ l.round }}</span> {{ l.text }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hm-root { padding: 8px 0 16px; color: var(--text); }
.hm-eyebrow { font-size: 12px; letter-spacing: .18em; color: var(--gold); font-weight: 700; }
.hm-title { font-size: 30px; margin: 4px 0 6px; letter-spacing: .08em; }
.hm-sub { margin: 0; color: var(--text-mute); font-size: 13px; }
.hm-setup-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.hm-setup-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; }
.hm-panel { background: var(--surface-2); border: 1px solid rgba(160,120,50,.28); border-radius: 14px; padding: 18px; }
.hm-h3 { margin: 0 0 12px; font-size: 15px; color: var(--gold); }
.hm-hint { font-size: 12px; color: var(--text-mute); margin: 8px 0 0; line-height: 1.6; }
.hm-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.hm-chip, .hm-btn { cursor: pointer; font-family: inherit; border-radius: 8px; transition: .18s; }
.hm-chip { padding: 7px 16px; border: 1px solid rgba(160,120,50,.4); background: transparent; color: var(--text); font-size: 13px; }
.hm-chip.on { background: var(--gold); color: #1a1208; font-weight: 700; }
.hm-heroes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.hm-hero { text-align: left; padding: 9px 11px; border: 1px solid rgba(160,120,50,.28); border-radius: 10px; background: rgba(255,255,255,.32); color: var(--text); cursor: pointer; }
.hm-hero.on { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold) inset; background: rgba(212,175,55,.1); }
.hm-hero b { display: block; font-size: 14px; margin-bottom: 3px; }
.hm-hero span { font-size: 11px; color: var(--text-mute); line-height: 1.45; display: block; }
.hm-steps { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.9; color: var(--text-dim); }
.hm-steps b { color: var(--text); }
.hm-link { margin: 10px 0; background: none; border: none; color: var(--gold); cursor: pointer; font-size: 12px; padding: 0; text-decoration: underline; }
.hm-formulas { background: rgba(255,255,255,.3); border-radius: 8px; padding: 10px; margin-bottom: 12px; }
.hm-formula { display: flex; gap: 10px; font-size: 12px; padding: 3px 0; }
.hm-formula b { min-width: 40px; color: var(--gold); }
.hm-btn { padding: 8px 16px; font-size: 13px; border: 1px solid var(--gold); background: transparent; color: var(--gold); }
.hm-btn.primary { background: var(--gold); color: #1a1208; font-weight: 700; }
.hm-btn.primary:hover { filter: brightness(1.08); }
.hm-btn.ghost { border-color: rgba(160,120,50,.4); color: var(--text-mute); }
.hm-btn.big { width: 100%; margin-top: 14px; padding: 11px; font-size: 15px; }
.hm-btn.small { padding: 4px 10px; font-size: 12px; }
.hm-btn:disabled { opacity: .45; cursor: not-allowed; }

.hm-topbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(160,120,50,.25); flex-wrap: wrap; }
.hm-topinfo { display: flex; gap: 7px; align-items: center; font-size: 13px; }
.hm-sep { color: var(--text-faint); }
.hm-topact { display: flex; gap: 8px; align-items: center; }
.hm-piles { font-size: 11px; color: var(--text-mute); }
.hm-seats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin: 12px 0; }
.hm-seat { border: 1px solid rgba(160,120,50,.25); border-radius: 10px; padding: 9px 10px; background: var(--surface-2); }
.hm-seat.active { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold) inset; }
.hm-seat.leader { background: rgba(212,175,55,.1); }
.hm-seat-top { display: flex; justify-content: space-between; font-size: 12px; }
.hm-crown { font-size: 10px; color: #1a1208; background: var(--gold); border-radius: 4px; padding: 1px 5px; }
.hm-general { font-size: 11px; color: var(--text-mute); margin: 4px 0; }
.hm-score { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: var(--text-mute); }
.hm-score b { font-size: 20px; color: var(--gold); }
.hm-handcount { font-size: 11px; color: var(--text-faint); }
.hm-event-banner { border-left: 3px solid #a33224; background: rgba(163,50,36,.08); padding: 9px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
.hm-board { margin-bottom: 12px; }
.hm-board-title { font-size: 12px; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
.hm-board-cards { display: flex; gap: 8px; flex-wrap: wrap; }
.hm-merit { min-width: 116px; border: 1px solid rgba(160,120,50,.35); border-radius: 8px; padding: 7px 10px; background: var(--surface-2); }
.hm-merit b { display: block; font-size: 14px; }
.hm-merit small { font-size: 10px; color: var(--text-mute); line-height: 1.4; display: block; }
.hm-merit.target { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold) inset; }
.hm-main { display: grid; grid-template-columns: 1fr 250px; gap: 16px; }
.hm-left { min-width: 0; }
.hm-hand-head { display: flex; gap: 10px; align-items: baseline; font-size: 13px; margin-bottom: 8px; }
.hm-hand-head span { font-size: 11px; color: var(--text-mute); }
.hm-hand { display: flex; flex-wrap: wrap; gap: 7px; min-height: 86px; }
.hm-card { width: 58px; height: 82px; border-radius: 8px; border: 1px solid rgba(160,120,50,.4); background: var(--surface-panel, var(--surface-2)); color: var(--text); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.hm-card b { font-size: 15px; }
.hm-card small { font-size: 9px; color: var(--text-mute); }
.hm-card.troop { border-color: #5b7a5b; }
.hm-card.tactic { border-color: #a8701a; }
.hm-card.response { border-color: #2f6b8f; }
.hm-card.pick { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold) inset; transform: translateY(-3px); }
.hm-combo-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(160,120,50,.3); font-size: 12px; }
.hm-ok { color: #2f6b4f; font-weight: 700; }
.hm-why { color: var(--text-mute); }
.hm-err { color: #a33224; width: 100%; }
.hm-combo-bar label { display: flex; gap: 5px; align-items: center; }
.hm-combo-bar select { background: var(--surface-2); color: var(--text); border: 1px solid rgba(160,120,50,.4); border-radius: 6px; padding: 4px; }
.hm-pending { border: 1px solid rgba(160,120,50,.4); border-radius: 10px; padding: 14px; background: var(--surface-2); margin-bottom: 10px; }
.hm-pending h3 { margin: 0 0 6px; font-size: 15px; color: var(--gold); }
.hm-pending p { font-size: 12.5px; margin: 4px 0 10px; color: var(--text-dim); }
.hm-alert { border-color: #a33224; }
.hm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hm-wait { color: var(--text-mute); font-size: 13px; padding: 20px 0; }
.hm-right { min-width: 0; }
.hm-log-title { font-size: 12px; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
.hm-log { border: 1px solid rgba(160,120,50,.25); border-radius: 10px; padding: 9px; background: var(--surface-2); max-height: 390px; overflow-y: auto; }
.hm-log-line { font-size: 11px; line-height: 1.5; padding: 3px 0; border-bottom: 1px dashed rgba(160,120,50,.13); color: var(--text-dim); }
.hm-log-line span { color: var(--text-faint); margin-right: 4px; }
.hm-log-line.k-good { color: #2f6b4f; }
.hm-log-line.k-warn, .hm-log-line.k-event { color: #a33224; }
.hm-log-line.k-skill { color: #6b4c8a; }
.hm-over { margin-top: 12px; border: 1px solid var(--gold); border-radius: 12px; padding: 18px; background: rgba(212,175,55,.08); text-align: center; }
.hm-over h2 { margin: 0 0 12px; font-size: 22px; }
.hm-over-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 10px; }
@media (max-width: 860px) {
  .hm-setup-grid, .hm-main { grid-template-columns: 1fr; }
  .hm-log { max-height: 220px; }
}
</style>
