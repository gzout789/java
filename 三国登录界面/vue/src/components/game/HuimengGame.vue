<script setup>
/**
 * 烽烟三国 · 会盟讨董 —— 与 SanguoGame.vue 并列的第二模式
 *
 * 复用：GameCard.vue 卡牌组件、rules.js 牌堆与牌名、HERO_SKILLS 26 名武将。
 * 纯本地对局，不请求 /api/heroes，接口不可用时照样能玩。
 */
import { ref, computed, onBeforeUnmount, reactive } from 'vue'
import GameCard from './GameCard.vue'
import { createHuimengGame } from '../../game/modes/huimeng/engine.js'
import {
  MODE, TROOPS, MODE_EFFECTS, HERO_NAMES, EFFECT_KEYS, counterOf
} from '../../game/modes/huimeng/constants.js'
import { claimCheck, needText, cardTroops } from '../../game/modes/huimeng/logic.js'

const props = defineProps({
  user: { type: Object, default: null }
})
const emit = defineEmits(['exit'])

const game = ref(null)
const st = computed(() => (game.value ? game.value.state : null))
const setup = ref(true)
const seatCount = ref(3)
const heroChoice = ref(HERO_NAMES[0])
const selectedUids = ref([])
const bountyIdx = ref(0)
const toast = ref('')
const showRules = ref(false)
let toastTimer = null

const playerName = computed(() => (props.user && props.user.username) || '你')

function makeGame() {
  const g = createHuimengGame({
    seatCount: seatCount.value,
    playerName: playerName.value,
    speed: 360
  })
  // 关键：让引擎内部持有响应式代理，state 的每次变更都能触发界面刷新
  g.state = reactive(g.state)
  g.state.autoBlock = true
  game.value = g
  return g
}

function start() {
  const g = makeGame()
  g.prepare(heroChoice.value)
  setup.value = false
  selectedUids.value = []
  bountyIdx.value = 0
  toast.value = ''
}

function restart() {
  if (game.value) game.value.destroy()
  setup.value = true
  selectedUids.value = []
  bountyIdx.value = 0
  toast.value = ''
}

function setAutoBlock(v) {
  if (game.value) game.value.state.autoBlock = v
}

onBeforeUnmount(() => {
  if (game.value) game.value.destroy()
  clearTimeout(toastTimer)
})

const me = computed(() => (st.value ? st.value.seats[0] : null))
const myTurn = computed(
  () => !!st.value && st.value.phase === 'playing' && st.value.turnIdx === 0 && !st.value.busy
)
const selectedCards = computed(() => {
  if (!me.value) return []
  return selectedUids.value
    .map((uid) => me.value.hand.find((c) => c.uid === uid))
    .filter(Boolean)
})
const bountyChecks = computed(() => {
  if (!st.value || !me.value) return []
  return st.value.bounty.map((b, i) => ({
    i,
    b,
    need: needText(me.value, b, st.value.flags),
    check: claimCheck(me.value, selectedCards.value, b, st.value.flags)
  }))
})
const canClaim = computed(() => {
  if (!myTurn.value) return false
  const item = bountyChecks.value[bountyIdx.value]
  return !!(item && item.check.ok)
})
const selectedTroops = computed(() => {
  if (!me.value) return '未选'
  const m = {}
  for (const c of selectedCards.value) {
    const ts = cardTroops(me.value, c)
    const label = ts.length > 1 ? '百变' : (TROOPS[ts[0]] ? TROOPS[ts[0]].name : '?')
    m[label] = (m[label] || 0) + 1
  }
  const text = Object.entries(m).map(([k, v]) => `${k}×${v}`).join('、')
  return text || '未选'
})
const peekEvent = computed(() => {
  if (!st.value || !me.value || !me.value.effect || me.value.effect.key !== 'peek') return null
  return st.value.eventDeck[0] || null
})
const flagText = computed(() => {
  if (!st.value) return ''
  const f = st.value.flags
  const parts = []
  if (f.claimCost) parts.push(`揭榜多付 ${f.claimCost} 令`)
  if (f.drawLess) parts.push(`少摸 ${f.drawLess} 令`)
  if (f.frozenTroop) parts.push(`${TROOPS[f.frozenTroop] ? TROOPS[f.frozenTroop].name : f.frozenTroop}令冻结`)
  return parts.join(' · ')
})

function weakText(ev) {
  if (!ev || !ev.weakness) return '正面事件 · 无需化解'
  const c = counterOf(ev.weakness)
  return `化解：弃 1 张${TROOPS[c] ? TROOPS[c].name : c}令`
}
function showToast(t) {
  toast.value = t
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2800)
}
function toggleCard(card) {
  if (!myTurn.value) return
  const i = selectedUids.value.indexOf(card.uid)
  if (i >= 0) selectedUids.value.splice(i, 1)
  else selectedUids.value.push(card.uid)
}
function doClaim() {
  const item = bountyChecks.value[bountyIdx.value]
  if (!canClaim.value) {
    const miss = item && item.check.missing.length ? `，还缺 ${item.check.missing.join('、')}` : ''
    showToast(`兵种不合：需要 ${item ? item.need : '—'}${miss}`)
    return
  }
  const r = game.value.claim(selectedUids.value.slice(), bountyIdx.value)
  showToast(r.msg || r.text)
  if (r.ok) selectedUids.value = []
}
async function endTurn() {
  if (!myTurn.value) return
  selectedUids.value = []
  await game.value.endTurn()
}
</script>

<template>
  <!-- ============ 开局设置 ============ -->
  <div v-if="!st || setup" class="hm-setup">
    <div class="set-panel">
      <span class="set-seal">盟</span>
      <h1>烽烟三国 · 会盟讨董</h1>
      <p class="set-sub">{{ MODE.subtitle }}</p>

      <div class="set-row">
        <label>诸侯人数</label>
        <div class="set-chips">
          <button v-for="n in [2, 3, 4, 5]" :key="n" type="button"
            :class="{ on: seatCount === n }" @click="seatCount = n">{{ n }} 人</button>
        </div>
        <small>你 + {{ seatCount - 1 }} 位 AI 诸侯，一局约 3–6 分钟</small>
      </div>

      <div class="set-row">
        <label>你的主将</label>
        <select v-model="heroChoice">
          <option v-for="h in HERO_NAMES" :key="h" :value="h">
            {{ h }} · {{ MODE_EFFECTS[h] ? MODE_EFFECTS[h].name : '无' }}
          </option>
        </select>
        <p class="set-eff" v-if="MODE_EFFECTS[heroChoice]">
          【{{ MODE_EFFECTS[heroChoice].name }}】{{ MODE_EFFECTS[heroChoice].desc }}
        </p>
      </div>

      <div class="set-tip">
        纯本地对局：牌堆 / 牌名 / 26 名武将全部复用《烽烟三国杀》既有资产，
        模式层只加「兵种标签 + 战功悬赏 + 董卓事件」。
      </div>
      <div class="set-btns">
        <button type="button" class="btn-main" @click="start">起兵会盟</button>
        <button type="button" class="btn-ghost" @click="emit('exit')">返回中军大帐</button>
      </div>
    </div>
  </div>

  <!-- ============ 牌桌 ============ -->
  <div v-else class="hm-root">
    <header class="hm-head">
      <div class="hm-title">
        <span class="hm-seal">盟</span>
        <div>
          <h1>烽烟三国 · 会盟讨董</h1>
          <p>{{ MODE.subtitle }} · 主将 {{ me.hero }}</p>
        </div>
      </div>
      <div class="hm-head-btns">
        <button type="button" @click="showRules = !showRules">玩法</button>
        <button type="button" @click="restart">重开</button>
        <button type="button" @click="emit('exit')">返回</button>
      </div>
    </header>

    <!-- 状态条 -->
    <section class="hm-status">
      <div class="hm-round">
        第 {{ st.round }} 轮
        <span>· {{ st.phase === 'over' ? '终局' : st.busy ? '诸侯议事中…' : '轮到你揭榜' }}</span>
      </div>
      <div v-if="st.currentEvent" class="hm-event">
        <b>董卓事件 · {{ st.currentEvent.name }}</b>
        <span>{{ st.currentEvent.desc }}</span>
        <em>{{ weakText(st.currentEvent) }}</em>
      </div>
      <div v-else class="hm-event ghost">董卓尚未发难 · 本轮末翻事件牌</div>
      <div v-if="peekEvent" class="hm-peek">【观星】下张事件：{{ peekEvent.name }}</div>
      <div v-if="flagText" class="hm-flags">本轮军令：{{ flagText }}</div>
    </section>

    <!-- 战功榜 -->
    <section class="hm-seats">
      <div v-for="s in st.seats" :key="s.idx" class="hm-seat"
        :class="{ me: s.isHuman, turn: st.turnIdx === s.idx && st.phase === 'playing' }">
        <div class="seat-top">
          <span class="seat-name">{{ s.name }}</span>
          <span class="seat-hero">{{ s.hero }}</span>
        </div>
        <div class="seat-merit"><b>{{ s.merit }}</b> / {{ MODE.winMerit }} 战功</div>
        <div class="seat-bar"><i :style="{ width: Math.min(100, (s.merit / MODE.winMerit) * 100) + '%' }"></i></div>
        <div v-if="s.effect" class="seat-eff">{{ s.effect.name }} · {{ EFFECT_KEYS[s.effect.key] }}</div>
        <div class="seat-hand">手牌 {{ s.hand.length }} 令 · 已得 {{ s.merits.length }} 榜</div>
      </div>
    </section>

    <!-- 军令榜 -->
    <section class="hm-bounty">
      <h2>军令榜 · 战功悬赏</h2>
      <div class="bounty-grid">
        <button v-for="item in bountyChecks" :key="item.b.uid" type="button" class="bounty"
          :class="{ active: bountyIdx === item.i, ok: item.check.ok, short: selectedCards.length > 0 && !item.check.ok }"
          :disabled="!myTurn" @click="bountyIdx = item.i">
          <span class="b-name">{{ item.b.name }}</span>
          <span class="b-need">需 {{ item.need }}</span>
          <span class="b-flavor">{{ item.b.flavor }}</span>
          <span class="b-check">
            {{ !selectedCards.length ? '选牌后判定' : item.check.ok ? '✓ 可揭榜' : '缺 ' + item.check.missing.join('、') }}
          </span>
        </button>
      </div>
    </section>

    <!-- 手牌 -->
    <section class="hm-hand">
      <div class="hand-head">
        <h2>你的手牌 <small>{{ me.hand.length }} 令 · 上限 {{ MODE.maxHand }}</small></h2>
        <div class="hand-actions">
          <label class="auto-block">
            <input type="checkbox" :checked="st.autoBlock !== false"
              @change="setAutoBlock($event.target.checked)" /> 自动以【挡】拦截 AI
          </label>
          <button type="button" class="btn-ghost" :disabled="!myTurn" @click="selectedUids = []">清选</button>
          <button type="button" class="btn-main" :disabled="!canClaim" @click="doClaim">揭榜 +1 战功</button>
          <button type="button" class="btn-alt" :disabled="!myTurn" @click="endTurn">结束回合 · 诸侯议事</button>
        </div>
      </div>
      <div class="hand-troops">已选兵种：<b>{{ selectedTroops }}</b></div>
      <div class="hand-cards">
        <GameCard v-for="c in me.hand" :key="c.uid" :card="c"
          :selected="selectedUids.includes(c.uid)" :disabled="!myTurn"
          @pick="toggleCard" />
        <div v-if="!me.hand.length" class="hand-empty">手中无令，结束回合以征粮。</div>
      </div>
      <div class="hand-legend">
        <span v-for="(t, k) in TROOPS" :key="k"><i :style="{ background: t.color }"></i>{{ t.name }}＝{{ t.desc }}</span>
        <span class="ring">克制环：骑 → 步 → 盾 → 谋 → 骑</span>
      </div>
    </section>

    <!-- 日志 -->
    <section class="hm-log">
      <h2>盟中纪事</h2>
      <div class="log-box">
        <div v-for="l in st.logs" :key="l.id" class="log-line" :class="l.type">
          <span class="log-round">{{ l.round }}</span>{{ l.text }}
        </div>
      </div>
    </section>

    <!-- 玩法浮层 -->
    <div v-if="showRules" class="hm-mask" @click.self="showRules = false">
      <div class="hm-rules">
        <h2>会盟讨董 · 玩法</h2>
        <ol>
          <li>每人开局 4 令，之后每回合征粮 2 令（主将【克己】【制衡】多摸 1 张）。</li>
          <li>选中手牌 → 在军令榜挑一张战功悬赏 → 兵种凑齐即可揭榜，得 1 战功。</li>
          <li>兵种来自既有牌：【击】骑兵、【援】步兵、【挡】盾兵、计略牌计谋、军械牌军械。</li>
          <li>四元克制环 <b>骑 → 步 → 盾 → 谋 → 骑</b>：弃 1 张克制兵种令可化解董卓事件。</li>
          <li>【挡】追赶：战功低于揭榜者的诸侯可打出【挡】令，迫其补付 1 令，否则揭榜作废。</li>
          <li>轮末翻 1 张董卓事件（火烧洛阳 / 吕布出阵 / 天子犒军…），结算后<b>才裁定胜负</b>。</li>
          <li>先积 {{ MODE.winMerit }} 战功者夺魁；并列时比手牌数，仍并列则共举盟主。</li>
        </ol>
        <p class="rules-note">术语遵循《烽烟三国杀》：【击】【挡】【援】【缓策】；阵营四 key 为 han / wei / shu / wu。</p>
        <button type="button" class="btn-main" @click="showRules = false">明白了</button>
      </div>
    </div>

    <!-- 终局 -->
    <div v-if="st.winner" class="hm-mask">
      <div class="hm-result">
        <span class="res-seal">{{ st.winner.draw ? '盟' : '魁' }}</span>
        <h2>{{ st.winner.draw ? '共举盟主' : '会盟夺魁' }}</h2>
        <p>{{ st.winner.text }}</p>
        <div class="res-seats">
          <div v-for="s in st.seats" :key="s.idx" :class="{ win: s.idx === st.winner.idx }">
            {{ s.name }}（{{ s.hero }}）· {{ s.merit }} 战功
          </div>
        </div>
        <div class="res-btns">
          <button type="button" class="btn-main" @click="restart">再开一局</button>
          <button type="button" class="btn-ghost" @click="emit('exit')">返回中军大帐</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="hm-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.hm-root,
.hm-setup {
  /* GameCard.vue 用到的两个局部变量，在这里兜底定义 */
  --g-hair: var(--hair, rgba(154, 111, 30, 0.45));
  --g-gold: var(--gold, #b07d22);
  --hm-ink: var(--text, #2c2114);
  --hm-dim: var(--text-dim, rgba(44, 33, 20, 0.72));
  --hm-panel: var(--surface-panel, linear-gradient(160deg, #fffbf3, #fcf5e6));
  --hm-line: var(--hair, rgba(154, 111, 30, 0.45));
}

.hm-root {
  min-height: 100vh;
  padding: 22px clamp(16px, 4vw, 56px) 56px;
  color: var(--hm-ink);
  font-family: var(--font-body, serif);
  background:
    radial-gradient(circle at 12% 8%, rgba(178, 34, 34, 0.07), transparent 34%),
    var(--paper, #f3e9d6);
}

h1, h2 { font-family: var(--font-cal, serif); font-weight: 600; }
button { font-family: inherit; cursor: pointer; }
button:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---------- 顶栏 ---------- */
.hm-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  border-bottom: 2px solid var(--hm-line); padding-bottom: 16px; margin-bottom: 20px; }
.hm-title { display: flex; align-items: center; gap: 14px; }
.hm-title h1 { font-size: clamp(20px, 2.4vw, 28px); letter-spacing: 4px; margin: 0; }
.hm-title p { margin: 4px 0 0; font-size: 12px; color: var(--hm-dim); letter-spacing: 1px; }
.hm-seal { width: 48px; height: 48px; flex: none; display: grid; place-items: center;
  border: 2px solid var(--primary, #b22222); border-radius: 8px; color: var(--primary, #b22222);
  font-size: 26px; font-family: var(--font-art, serif); transform: rotate(-4deg); }
.hm-head-btns { display: flex; gap: 8px; }
.hm-head-btns button { padding: 7px 14px; border: 1px solid var(--hm-line); border-radius: var(--r-sm, 6px);
  background: var(--surface-2, rgba(255, 250, 240, 0.85)); color: var(--hm-ink); font-size: 13px; letter-spacing: 1px; }
.hm-head-btns button:hover { border-color: var(--primary, #b22222); }

/* ---------- 状态条 ---------- */
.hm-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;
  padding: 12px 16px; border: 1px solid var(--hm-line); border-radius: var(--r-md, 8px);
  background: var(--hm-panel); }
.hm-round { font-size: 15px; letter-spacing: 2px; white-space: nowrap; }
.hm-round span { font-size: 12px; color: var(--hm-dim); }
.hm-event { flex: 1 1 320px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap;
  border-left: 3px solid var(--primary, #b22222); padding-left: 12px; font-size: 12.5px; }
.hm-event b { color: var(--primary, #b22222); letter-spacing: 1px; }
.hm-event span { color: var(--hm-dim); }
.hm-event em { color: #2f6b4f; font-style: normal; }
.hm-event.ghost { border-left-color: var(--hm-line); color: var(--hm-dim); }
.hm-peek, .hm-flags { font-size: 12px; padding: 4px 10px; border-radius: 999px;
  background: rgba(154, 111, 30, 0.12); color: var(--hm-dim); }

/* ---------- 战功榜 ---------- */
.hm-seats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.hm-seat { padding: 12px 14px; border: 1px solid var(--hm-line); border-radius: var(--r-md, 8px);
  background: var(--hm-panel); position: relative; }
.hm-seat.me { border-color: var(--primary, #b22222); box-shadow: 0 0 0 1px rgba(178, 34, 34, 0.2); }
.hm-seat.turn::after { content: '议事中'; position: absolute; right: 10px; top: 10px; font-size: 10px;
  color: var(--primary, #b22222); letter-spacing: 1px; }
.seat-top { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
.seat-name { font-size: 15px; font-weight: 600; letter-spacing: 1px; }
.seat-hero { font-size: 11px; color: var(--hm-dim); }
.seat-merit { margin: 6px 0 4px; font-size: 12px; color: var(--hm-dim); }
.seat-merit b { font-size: 24px; color: var(--primary, #b22222); font-family: var(--font-cal, serif); }
.seat-bar { height: 5px; border-radius: 999px; background: rgba(120, 90, 40, 0.14); overflow: hidden; }
.seat-bar i { display: block; height: 100%; background: linear-gradient(90deg, #b22222, #d4af37); transition: width 0.4s; }
.seat-eff { margin-top: 8px; font-size: 11px; color: #2f6b4f; }
.seat-hand { margin-top: 4px; font-size: 11px; color: var(--hm-dim); }

/* ---------- 军令榜 ---------- */
.hm-bounty, .hm-hand, .hm-log { margin-bottom: 20px; }
.hm-bounty h2, .hm-hand h2, .hm-log h2 { font-size: 17px; letter-spacing: 3px; margin: 0 0 10px; }
.hm-bounty h2::before, .hm-hand h2::before, .hm-log h2::before { content: '◆'; color: var(--primary, #b22222);
  font-size: 11px; margin-right: 8px; vertical-align: 2px; }
.bounty-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.bounty { text-align: left; padding: 14px 16px; border: 1px solid var(--hm-line); border-radius: var(--r-md, 8px);
  background: var(--hm-panel); color: var(--hm-ink); display: flex; flex-direction: column; gap: 4px;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
.bounty:hover:not(:disabled) { transform: translateY(-3px); }
.bounty.active { border-color: var(--g-gold); box-shadow: 0 0 0 1px var(--g-gold); }
.bounty.ok { border-color: #2f6b4f; }
.bounty.short { opacity: 0.62; }
.b-name { font-size: 19px; font-family: var(--font-cal, serif); letter-spacing: 3px; }
.b-need { font-size: 12px; color: var(--primary, #b22222); letter-spacing: 1px; }
.b-flavor { font-size: 11.5px; color: var(--hm-dim); line-height: 1.6; }
.b-check { margin-top: 6px; font-size: 11px; color: #2f6b4f; }

/* ---------- 手牌 ---------- */
.hand-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.hand-head h2 small { font-size: 11px; font-weight: 400; color: var(--hm-dim); letter-spacing: 0; }
.hand-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.auto-block { font-size: 11.5px; color: var(--hm-dim); display: inline-flex; align-items: center; gap: 4px; }
.hand-actions button { padding: 8px 14px; border-radius: var(--r-sm, 6px); font-size: 12.5px; letter-spacing: 1px; }
.btn-main { color: #fff8ec; border: 1px solid var(--primary-deep, #7a1414);
  background: linear-gradient(135deg, var(--primary, #b22222), var(--primary-deep, #7a1414)); }
.btn-ghost { color: var(--hm-ink); border: 1px solid var(--hm-line); background: transparent; }
.btn-alt { color: var(--primary, #b22222); border: 1px solid var(--primary, #b22222);
  background: rgba(178, 34, 34, 0.06); }
.hand-troops { margin: 10px 0; font-size: 12px; color: var(--hm-dim); }
.hand-troops b { color: var(--hm-ink); }
.hand-cards { display: flex; gap: 8px; flex-wrap: wrap; min-height: 96px; padding: 12px;
  border: 1px dashed var(--hm-line); border-radius: var(--r-md, 8px); background: rgba(255, 250, 240, 0.4); }
.hand-empty { font-size: 12px; color: var(--hm-dim); }
.hand-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 10px; font-size: 11px; color: var(--hm-dim); }
.hand-legend span { display: inline-flex; align-items: center; gap: 5px; }
.hand-legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.hand-legend .ring { color: var(--primary, #b22222); letter-spacing: 1px; }

/* ---------- 日志 ---------- */
.log-box { max-height: 210px; overflow-y: auto; padding: 10px 14px; border: 1px solid var(--hm-line);
  border-radius: var(--r-md, 8px); background: var(--hm-panel); }
.log-line { font-size: 12px; line-height: 1.9; color: var(--hm-dim); border-bottom: 1px dashed rgba(154, 111, 30, 0.16); }
.log-line:last-child { border-bottom: 0; }
.log-round { display: inline-block; min-width: 22px; color: var(--g-gold); font-family: monospace; }
.log-line.claim { color: var(--hm-ink); }
.log-line.event { color: var(--primary, #b22222); }
.log-line.warn { color: #8a6a3b; }
.log-line.win { color: #2f6b4f; font-weight: 600; }

/* ---------- 浮层 ---------- */
.hm-mask { position: fixed; inset: 0; z-index: var(--z-modal, 50); display: grid; place-items: center;
  padding: 20px; background: rgba(26, 18, 8, 0.55); backdrop-filter: blur(3px); }
.hm-rules, .hm-result { width: min(620px, 100%); max-height: 86vh; overflow-y: auto; padding: 28px 32px;
  border: 1px solid var(--hm-line); border-top: 4px solid var(--primary, #b22222); border-radius: 10px;
  background: var(--surface-panel, #fffbf3); color: var(--hm-ink); box-shadow: var(--shadow-card, 0 18px 50px rgba(0,0,0,.5)); }
.hm-rules h2, .hm-result h2 { font-size: 22px; letter-spacing: 4px; margin: 0 0 16px; }
.hm-rules ol { padding-left: 20px; font-size: 13px; line-height: 2; }
.hm-rules li { margin-bottom: 4px; }
.rules-note { font-size: 11.5px; color: var(--hm-dim); border-left: 3px solid var(--hm-line); padding-left: 10px; }
.hm-rules .btn-main { margin-top: 16px; }
.res-seal { display: grid; place-items: center; width: 56px; height: 56px; margin: 0 auto 12px;
  border: 2px solid var(--primary, #b22222); color: var(--primary, #b22222); border-radius: 8px;
  font-size: 30px; font-family: var(--font-art, serif); }
.hm-result { text-align: center; }
.hm-result > p { font-size: 15px; letter-spacing: 1px; margin-bottom: 18px; }
.res-seats { display: grid; gap: 6px; margin: 0 auto 20px; max-width: 380px; font-size: 12.5px; color: var(--hm-dim); }
.res-seats .win { color: var(--primary, #b22222); font-weight: 600; }
.res-btns { display: flex; gap: 10px; justify-content: center; }
.res-btns button { padding: 9px 18px; border-radius: 6px; }

.hm-toast { position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 60;
  padding: 10px 20px; border-radius: 999px; background: rgba(42, 32, 24, 0.92); color: #f7ecd8;
  font-size: 13px; letter-spacing: 1px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }

/* ---------- 开局设置 ---------- */
.hm-setup { min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(circle at 30% 15%, rgba(178, 34, 34, 0.09), transparent 40%), var(--paper, #f3e9d6); }
.set-panel { width: min(520px, 100%); padding: 36px 40px 32px; text-align: center;
  border: 1px solid var(--hm-line); border-top: 4px solid var(--primary, #b22222); border-radius: 12px;
  background: var(--surface-panel, #fffbf3); box-shadow: var(--shadow-card, 0 18px 50px rgba(0,0,0,.4)); }
.set-seal { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 14px;
  border: 2px solid var(--primary, #b22222); color: var(--primary, #b22222); border-radius: 9px;
  font-size: 32px; font-family: var(--font-art, serif); transform: rotate(-5deg); }
.set-panel h1 { font-size: 26px; letter-spacing: 5px; margin: 0; }
.set-sub { font-size: 12.5px; color: var(--hm-dim); letter-spacing: 1px; margin: 8px 0 26px; }
.set-row { text-align: left; margin-bottom: 20px; }
.set-row > label { display: block; font-size: 12px; letter-spacing: 2px; color: var(--hm-dim); margin-bottom: 8px; }
.set-row small { display: block; margin-top: 7px; font-size: 11px; color: var(--hm-dim); }
.set-chips { display: flex; gap: 8px; }
.set-chips button { flex: 1; padding: 9px 0; border: 1px solid var(--hm-line); border-radius: 6px;
  background: transparent; color: var(--hm-ink); font-size: 13px; }
.set-chips button.on { border-color: var(--primary, #b22222); background: rgba(178, 34, 34, 0.1);
  color: var(--primary, #b22222); font-weight: 600; }
.set-row select { width: 100%; padding: 10px 12px; border: 1px solid var(--hm-line); border-radius: 6px;
  background: var(--surface-2, #fffaf0); color: var(--hm-ink); font-family: inherit; font-size: 14px; }
.set-eff { margin: 8px 0 0; font-size: 11.5px; color: #2f6b4f; line-height: 1.6; }
.set-tip { font-size: 11.5px; color: var(--hm-dim); line-height: 1.8; text-align: left;
  border-left: 3px solid var(--hm-line); padding-left: 10px; margin-bottom: 22px; }
.set-btns { display: flex; gap: 10px; }
.set-btns button { flex: 1; padding: 11px 0; border-radius: 6px; font-size: 14px; letter-spacing: 2px; }

@media (max-width: 640px) {
  .set-panel { padding: 26px 22px; }
  .hm-root { padding: 16px 12px 40px; }
  .hand-actions { width: 100%; }
}
</style>
