<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { authHeaders, theme, toggleTheme } from '../../composables/useTheme.js'
import { createGame } from '../../game/engine.js'
import {
  toGameHero, ROLES, CARDS, EQUIPS, SKILL_TYPES, cardName, isDelay, isEquip
} from '../../game/rules.js'
import GameSeat from './GameSeat.vue'
import GameCard from './GameCard.vue'

const props = defineProps({
  user: { type: Object, default: null }
})
const emit = defineEmits(['exit'])

const loading = ref(true)
const error = ref('')
const heroPool = ref([])
const game = ref(null)
const logBox = ref(null)

/* 交互态 */
const selectedUid = ref(null)
const selecting = ref(null) // { card, as, candidates }
const skillMode = ref(null) // { eff, need, count, picked }
const skillMenu = ref(false) // 多技能武将的技能菜单
const discardPick = ref([])
const toastText = ref('')
let toastTimer = null

const st = computed(() => (game.value ? game.value.state : null))
const me = computed(() => (st.value ? st.value.seats[0] : null))
const pending = computed(() => (st.value ? st.value.pending : null))
const myTurn = computed(() => !!st.value && st.value.phase === 'playing' && st.value.turnIdx === 0)
const selectedCard = computed(() =>
  me.value ? me.value.hand.find((c) => c.uid === selectedUid.value) || null : null
)

const STAGE_NAMES = { start: '启策', judge: '判定', draw: '征粮', play: '用兵', discard: '收兵', end: '收阵' }
const stageName = computed(() => STAGE_NAMES[st.value ? st.value.stage : ''] || '—')

/* ==================== 载入英雄榜 ==================== */

onMounted(loadHeroes)
onBeforeUnmount(() => {
  if (game.value) game.value.destroy()
})

async function loadHeroes() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/heroes', { headers: authHeaders() })
    const body = await res.json().catch(() => null)
    const list = (body && body.data) || []
    if (!Array.isArray(list) || list.length < 5) {
      error.value = '英雄榜武将不足 5 位，无法开局（请先在后台录入武将）'
      return
    }
    heroPool.value = list.map(toGameHero)
    newGame()
  } catch (e) {
    error.value = '读取英雄榜失败：' + (e && e.message ? e.message : '网络异常')
  } finally {
    loading.value = false
  }
}

function newGame() {
  if (game.value) game.value.destroy()
  resetUI()
  game.value = createGame(heroPool.value, {
    seatCount: 5,
    playerName: (props.user && props.user.username) || '你'
  })
  game.value.prepare()
}

function resetUI() {
  selectedUid.value = null
  selecting.value = null
  skillMode.value = null
  skillMenu.value = false
  discardPick.value = []
}

function startGame(heroId) {
  resetUI()
  game.value.start(heroId)
}

function restart() {
  newGame()
}

function exit() {
  if (game.value) game.value.destroy()
  emit('exit')
}

function toast(text) {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastText.value = ''), 2200)
}

/* ==================== 手牌操作 ==================== */

function onHandCard(card) {
  const g = game.value
  if (!g || !me.value) return
  const p = pending.value

  // 响应阶段：直接把牌交出去
  if (p && p.idx === 0) {
    if (p.kind === 'dodge' && g.canBeDodge(me.value, card)) return respond('dodge', card.uid)
    if (p.kind === 'save' && (card.key === 'heal' || (p.allowRed && ['heart', 'diamond'].includes(card.suit)))) {
      return respond('save', card.uid)
    }
    if (p.kind === 'judgeSwap') return respond('judgeSwap', card.uid)
    if (p.kind === 'negate' && card.key === 'negate') return respond('negate', card.uid)
    if (p.kind === 'duel' && g.canBeSlash(me.value, card)) return respond('duelSlash', card.uid)
    return
  }

  // 收兵弃牌
  if (p && p.kind === 'discard') return toggleDiscard(card.uid)

  // 技能需要弃牌
  if (skillMode.value && skillMode.value.need === 'cards') return toggleSkillCard(card.uid)

  if (!myTurn.value || st.value.stage !== 'play') return
  selectedUid.value = selectedUid.value === card.uid ? null : card.uid
}

/** 该牌可以当什么用 */
const cardOptions = computed(() => {
  const g = game.value
  const card = selectedCard.value
  if (!g || !card || !me.value) return []
  const keys = Array.from(new Set(g.usableAs(me.value, card)))
  return keys.map((k) => ({
    key: k,
    label: k === card.key ? `使用【${cardName(k)}】` : `当作【${cardName(k)}】`
  }))
})

function playSelected(asKey) {
  const g = game.value
  const card = selectedCard.value
  if (!g || !card || !me.value) return
  const key = asKey || card.key
  const as = key === card.key ? undefined : key

  if (isEquip(key)) {
    g.useCard(me.value, card, 0)
    selectedUid.value = null
    return
  }

  let cands = []
  if (key === 'slash') {
    cands = g.slashTargets(me.value).map((s) => s.idx)
  } else if (key === 'heal') {
    cands = st.value.seats
      .filter((s) => s.alive && s.hp < s.maxHp)
      .map((s) => s.idx)
  } else if (isDelay(key) || key === 'steal' || key === 'duel') {
    cands = g.schemeTargets(me.value, key).map((s) => s.idx)
  } else {
    cands = [0]
  }

  if (!cands.length) {
    toast('此刻没有合法的目标')
    return
  }
  if (cands.length === 1) {
    g.useCard(me.value, card, cands[0], as)
    selectedUid.value = null
    return
  }
  selecting.value = { card, as, candidates: cands }
}

function cancelSelect() {
  selecting.value = null
  selectedUid.value = null
  skillMode.value = null
  skillMenu.value = false
}

function onSeatClick(seat) {
  const g = game.value
  if (!g) return
  if (selecting.value && selecting.value.candidates.includes(seat.idx)) {
    const { card, as } = selecting.value
    selecting.value = null
    selectedUid.value = null
    g.useCard(me.value, card, seat.idx, as)
    return
  }
  const m = skillMode.value
  if (m && m.need === 'target') {
    if (!seat.alive) return
    if (seat.idx === 0 && !m.self) return
    if (m.eff === 'secret_unblockable' && !g.inReach(me.value, seat)) {
      return toast('超出攻击范围')
    }
    if (m.multi) {
      const idxs = m.pickedSeats || (m.pickedSeats = [])
      const i = idxs.indexOf(seat.idx)
      if (i >= 0) idxs.splice(i, 1)
      else idxs.push(seat.idx)
      if (idxs.length >= m.multi) {
        const payload = {
          targetIdx: idxs[0],
          targetIdx2: idxs[1],
          targetIdx3: idxs[2]
        }
        const eff = m.eff
        const secret = m.secret
        skillMode.value = null
        if (secret) g.useSecretSkill(me.value, { skillEffect: eff, ...payload })
        else g.useSkill(me.value, { skillEffect: eff, ...payload })
      }
      return
    }
    const payload = { targetIdx: seat.idx }
    if (m.cardUids) payload.cardUids = m.cardUids
    const eff = m.eff
    const secret = m.secret
    skillMode.value = null
    if (secret) g.useSecretSkill(me.value, { skillEffect: eff, ...payload })
    else g.useSkill(me.value, { skillEffect: eff, ...payload })
  }
}

/* ==================== 技能 ==================== */

const ACTIVE_SKILLS = [
  'draw1', 'balance', 'steal_card', 'force_discard', 'slash_boost', 'aoe_damage',
  'give_rende', 'ban_slash', 'star_gaze', 'heal_ally', 'heal_skill', 'duel_two'
]

/** 我可主动发动的技能（含秘计） */
const myActives = computed(() => {
  if (!me.value) return []
  const list = me.value.hero.skills || [me.value.hero.skill]
  return list.filter((s) => !Array.isArray(s.effect) && ACTIVE_SKILLS.includes(s.effect))
})

/** 我的秘计（一局一次） */
const mySecret = computed(() => {
  if (!me.value || me.value.secretUsed) return null
  const s = me.value.hero.secret
  if (!s || !s.effect) return null
  return s
})

/** 需要选目标的技能 → 目标候选 */
function skillTargetsOf(eff) {
  const g = game.value
  const alive = st.value.seats.filter((s) => s.alive && s.idx !== 0)
  if (eff === 'heal_skill') {
    // 青囊可救自己
    return st.value.seats.filter((s) => s.alive && s.hp < s.maxHp)
  }
  if (eff === 'secret_unblockable') {
    return alive.filter((s) => g.inReach(me.value, s))
  }
  return alive
}

/** 发动一个技能：先校验，再进入对应的选牌/选人流程 */
function triggerSkill(eff) {
  const g = game.value
  const h = me.value.hand.length
  skillMenu.value = null
  if (eff === 'draw1') return g.useSkill(me.value, { skillEffect: eff })
  if (eff === 'aoe_damage') {
    if (h < 2) return toast('需弃两张手牌才能发动')
    skillMode.value = { eff, need: 'cards', count: 2, picked: [] }
    return
  }
  if (eff === 'slash_boost' || eff === 'star_gaze') {
    if (h < 1) return toast('手上无牌可弃')
    skillMode.value = { eff, need: 'cards', count: 1, picked: [] }
    return
  }
  if (eff === 'balance') {
    if (h < 1) return toast('手上无牌可弃')
    skillMode.value = { eff, need: 'cards', count: 0, picked: [] }
    return
  }
  if (eff === 'give_rende' || eff === 'heal_ally') {
    if (h < 2) return toast('需两张手牌')
    skillMode.value = { eff, need: 'cards', count: 2, picked: [], then: 'target' }
    return
  }
  if (eff === 'ban_slash') {
    if (h < 1) return toast('需弃一张手牌才能发动')
    skillMode.value = { eff, need: 'target', picked: [] }
    return
  }
  if (eff === 'steal_card' || eff === 'force_discard') {
    if (h < 1) return toast('需弃一张手牌才能发动')
    skillMode.value = { eff, need: 'target', picked: [] }
    return
  }
  if (eff === 'heal_skill') {
    const cands = skillTargetsOf(eff)
    if (!cands.length) return toast('没有已受伤的角色')
    if (cands.length === 1 && h >= 1) {
      skillMode.value = null
      return g.useSkill(me.value, { skillEffect: eff, targetIdx: cands[0].idx })
    }
    if (h < 1) return toast('手上无牌可弃')
    skillMode.value = { eff, need: 'target', self: true, picked: [] }
    return
  }
  if (eff === 'duel_two') {
    if (h < 1) return toast('需弃一张牌才能发动')
    skillMode.value = { eff, need: 'target', multi: 2, pickedSeats: [], picked: [] }
    return
  }
}

/** 发动秘计 */
function triggerSecret() {
  const g = game.value
  const eff = mySecret.value.effect
  skillMenu.value = null
  if (eff === 'secret_revive') {
    if (me.value.hp > 1) return toast('【七星】只在体力不高于 1 点时方可禳星')
    return g.useSecretSkill(me.value, { skillEffect: eff })
  }
  if (eff === 'secret_aoe_force') {
    if (!me.value.hand.some((c) => g.canBeSlash(me.value, c))) return toast('需一张【击】才能引弓立威')
    return g.useSecretSkill(me.value, { skillEffect: eff })
  }
  if (eff === 'secret_unblockable' || eff === 'secret_rescue') {
    skillMode.value = { eff, need: 'target', secret: true, picked: [] }
    return
  }
  if (eff === 'secret_aoe_fire') {
    const hasRed = me.value.hand.some((c) => ['heart', 'diamond'].includes(c.suit))
    if (!hasRed) return toast('需一张红色手牌')
    skillMode.value = { eff, need: 'target', multi: 2, secret: true, pickedSeats: [], picked: [] }
    return
  }
  if (eff === 'secret_aoe_burn') {
    const hasRed = me.value.hand.some((c) => ['heart', 'diamond'].includes(c.suit))
    if (!hasRed) return toast('需红色手牌')
    skillMode.value = { eff, need: 'target', multi: 3, min: 1, secret: true, pickedSeats: [], picked: [] }
    return
  }
}

function toggleSkillCard(uid) {
  if (!skillMode.value) return
  const picked = skillMode.value.picked
  const i = picked.indexOf(uid)
  if (i >= 0) picked.splice(i, 1)
  else picked.push(uid)
  if (skillMode.value.count === 1 && picked.length === 1) {
    const uid0 = picked[0]
    const eff = skillMode.value.eff
    const isSecret = skillMode.value.secret
    skillMode.value = null
    if (isSecret) {
      game.value.useSecretSkill(me.value, { skillEffect: eff, cardUid: uid0 })
    } else {
      game.value.useSkill(me.value, { skillEffect: eff, cardUid: uid0 })
    }
  }
}

function confirmSkill() {
  if (!skillMode.value) return
  const uids = skillMode.value.picked.slice()
  if (!uids.length) return toast('请先选择要弃置的手牌')
  if (skillMode.value.then === 'target') {
    // 仁德/联姻：先选两张牌，再选目标
    skillMode.value = { eff: skillMode.value.eff, need: 'target', cardUids: uids, picked: [] }
    return
  }
  const eff = skillMode.value.eff
  skillMode.value = null
  game.value.useSkill(me.value, { skillEffect: eff, cardUids: uids })
}

/* ==================== 响应与阶段推进 ==================== */

function respond(type, cardUid) {
  game.value.submit({ type, cardUid })
}
function respondNone() {
  game.value.submit(null)
}

function endPhase() {
  game.value.endPlayPhase()
}

function toggleDiscard(uid) {
  const p = pending.value
  if (!p) return
  const i = discardPick.value.indexOf(uid)
  if (i >= 0) discardPick.value.splice(i, 1)
  else discardPick.value.push(uid)
  if (discardPick.value.length >= p.need) {
    game.value.confirmDiscard(discardPick.value.slice())
    discardPick.value = []
  }
}

/* ==================== 提示文案 ==================== */

const hint = computed(() => {
  if (!st.value) return ''
  if (selecting.value) return `选择【${cardName(selecting.value.as || selecting.value.card.key)}】的目标：点击高亮的座位`
  if (skillMode.value) {
    const m = skillMode.value
    if (m.need === 'target' && m.multi) {
      return `指定 ${m.multi} 个目标（已选 ${(m.pickedSeats || []).length} 个）：点击座位选择，选满自动发动`
    }
    if (m.need === 'target') {
      const named = m.self ? '一名角色（可点自己）' : '一名其他角色'
      return `发动武将技：点击${named}`
    }
    const cnt = m.count || 0
    const label = m.eff === 'give_rende' || m.eff === 'heal_ally' ? '赠予' : '弃置'
    if (cnt === 0) return `弃置任意数量手牌以发动（已选 ${m.picked.length} 张）`
    return `${label} ${cnt} 张手牌以发动（已选 ${m.picked.length} 张）`
  }
  const p = pending.value
  if (p && p.idx !== 0) return `${st.value.seats[p.idx].label} 正在抉择…`
  if (p && p.kind === 'discard') return `收兵：需弃置 ${p.need} 张手牌（点击手牌选择）`
  if (p && p.kind === 'dodge') return p.text
  if (p && p.kind === 'save') return p.text
  if (p && p.kind === 'judgeSwap') return p.text
  if (p && p.kind === 'negate') return p.text
  if (p && p.kind === 'duel') return p.text
  if (st.value.phase === 'over') return '战事已终'
  if (myTurn.value) return '用兵阶段：出牌或点「收兵」结束'
  return `${st.value.seats[st.value.turnIdx].label} 的回合（${stageName.value}阶段）…`
})

const canAct = computed(() => {
  const p = pending.value
  if (p && p.idx === 0) return true
  if (!p && myTurn.value && st.value.stage === 'play') return true
  return false
})

/* ==================== 日志滚动 ==================== */

watch(
  () => (st.value ? st.value.log.length : 0),
  () => {
    nextTick(() => {
      if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
    })
  }
)

const LOG_TONE = { sys: '', hit: 'hit', good: 'good', death: 'death', warn: 'warn', skill: 'skill', gold: 'gold' }

function seatClass(idx) {
  return 'p' + idx
}
</script>

<template>
  <div class="game-root">
    <!-- 顶栏 -->
    <header class="g-top">
      <div class="brand">
        <span class="b-main">烽烟三国杀</span>
        <span class="b-sub">5 人局 · 身份暗战</span>
      </div>
      <div class="grow"></div>
      <div v-if="me" class="my-role">
        <span class="mr-label">我的身份</span>
        <span class="mr-val" :style="{ background: ROLES[me.role].color }">{{ ROLES[me.role].name }}</span>
        <span class="mr-goal">{{ ROLES[me.role].goal }}</span>
      </div>
      <button type="button" class="t-btn" @click="toggleTheme()">
        {{ theme === 'dark' ? '☾ 夜色' : '☀ 宣纸' }}
      </button>
      <button type="button" class="t-btn" @click="exit">收兵回营</button>
    </header>

    <!-- 载入 / 错误 -->
    <div v-if="loading" class="state-box">正在点兵…</div>
    <div v-else-if="error" class="state-box err">
      {{ error }}
      <button type="button" class="t-btn" @click="exit">返回</button>
    </div>

    <!-- 选将 -->
    <section v-else-if="st.phase === 'select'" class="pick">
      <h2 class="pick-title">择一良将出战</h2>
      <p class="pick-tip">武将悉数取自英雄榜；体力与武将技可在后台管理系统调整</p>
      <div class="pick-grid">
        <button
          v-for="h in st.candidates"
          :key="h.id"
          type="button"
          class="pick-card"
          :style="{ '--fac': h.factionColor }"
          @click="startGame(h.id)"
        >
          <div class="pc-top">
            <span class="pc-name">{{ h.name }}</span>
            <span class="pc-fac">{{ h.factionName }}</span>
          </div>
          <div class="pc-epithet">{{ h.epithet }}</div>
          <div class="pc-hp">体力 {{ h.hp }} · 武力 {{ h.power }} · 统率 {{ h.leadership }}</div>
          <div class="pc-skills">
            <div
              v-for="s in (h.skills && h.skills.length ? h.skills : [h.skill])"
              :key="s.name"
              class="pc-skill"
              :title="s.allusion ? s.desc + '\n【典故】' + s.allusion : s.desc"
            >
              <span class="pc-type" :style="{ color: SKILL_TYPES[s.type].color }">
                {{ s.type }}
              </span>
              <span class="pc-sname">{{ s.name }}</span>
              <span class="pc-sdesc">{{ s.desc }}</span>
            </div>
          </div>
        </button>
      </div>
      <p class="pick-foot">开局后身份随机分配：1 汉主（明置）+ 1 忠良 + 2 群雄 + 1 隐客</p>
    </section>

    <!-- 牌桌 -->
    <div v-else class="board">
      <section class="table">
        <GameSeat
          v-for="s in st.seats"
          :key="s.idx"
          :class="seatClass(s.idx)"
          :seat="s"
          :is-me="s.idx === 0"
          :current="st.turnIdx === s.idx && st.phase === 'playing'"
          :selectable="
            !!(selecting && selecting.candidates.includes(s.idx)) ||
            !!(skillMode && skillMode.need === 'target' && s.alive && (skillMode.self || s.idx !== 0))
          "
          @pick="onSeatClick"
        />
        <div class="center">
          <div class="c-round">第 {{ st.round }} 轮</div>
          <div class="c-stage">{{ stageName }}阶段</div>
          <div class="c-piles">
            <span>牌堆 {{ st.deck.length }}</span>
            <span>弃牌 {{ st.discard.length }}</span>
          </div>
        </div>
      </section>

      <aside class="log-panel">
        <div class="lp-title">战报</div>
        <div ref="logBox" class="lp-body">
          <p v-for="(l, i) in st.log" :key="i" :class="LOG_TONE[l.tone]">{{ l.text }}</p>
        </div>
      </aside>
    </div>

    <!-- 底部操作区 -->
    <footer v-if="st.phase === 'playing'" class="dock">
      <div class="hint-row">
        <span class="hint">{{ hint }}</span>
        <span v-if="toastText" class="toast">{{ toastText }}</span>
      </div>

      <div class="action-row">
        <!-- 响应 -->
        <template v-if="pending && pending.idx === 0">
          <button
            v-if="pending.kind === 'dodge'"
            type="button"
            class="a-btn primary"
            @click="respondNone()"
          >
            不出【挡】
          </button>
          <button
            v-else-if="pending.kind === 'save'"
            type="button"
            class="a-btn"
            @click="respondNone()"
          >
            坐视不救
          </button>
          <button
            v-else-if="pending.kind === 'judgeSwap'"
            type="button"
            class="a-btn"
            @click="respondNone()"
          >
            不改判
          </button>
          <button
            v-else-if="pending.kind === 'negate'"
            type="button"
            class="a-btn"
            @click="respondNone()"
          >
            不用【缓策】
          </button>
          <button
            v-else-if="pending.kind === 'duel'"
            type="button"
            class="a-btn danger"
            @click="respondNone()"
          >
            认输受创
          </button>
          <span class="a-tip">点击手牌以响应</span>
        </template>

        <!-- 技能菜单（多技能武将） -->
        <div v-if="skillMenu && myTurn && st.stage === 'play' && !selectedCard && !(pending && pending.idx === 0)" class="skill-menu">
          <button
            v-for="s in myActives"
            :key="s.name"
            type="button"
            class="sm-item"
            :title="s.allusion ? s.desc + '\n【典故】' + s.allusion : s.desc"
            @click="triggerSkill(s.effect)"
          >
            <span class="sm-name">{{ s.name }}</span>
            <span class="sm-type">{{ s.type }}</span>
          </button>
        </div>

        <!-- 选中手牌后的可用动作 -->
        <template v-else-if="selectedCard">
          <button
            v-for="opt in cardOptions"
            :key="opt.key"
            type="button"
            class="a-btn"
            @click="playSelected(opt.key)"
          >
            {{ opt.label }}
          </button>
          <button type="button" class="a-btn ghost" @click="cancelSelect()">取消</button>
        </template>

        <!-- 出牌阶段常规操作 -->
        <template v-else-if="myTurn && st.stage === 'play'">
          <button
            v-if="myActives.length === 1"
            type="button"
            class="a-btn skill"
            :title="myActives[0].allusion"
            @click="triggerSkill(myActives[0].effect)"
          >
            发动【{{ myActives[0].name }}】
          </button>
          <button
            v-else-if="myActives.length > 1"
            type="button"
            class="a-btn skill"
            @click="skillMenu = !skillMenu"
          >
            发动技能 ▾
          </button>
          <button
            v-if="mySecret"
            type="button"
            class="a-btn secret"
            :title="mySecret.allusion"
            @click="triggerSecret()"
          >
            秘计【{{ mySecret.name }}】
          </button>
          <button v-if="skillMode && skillMode.need === 'cards'" type="button" class="a-btn" @click="confirmSkill()">
            确定弃牌（{{ skillMode.picked.length }}）
          </button>
          <button v-if="skillMode" type="button" class="a-btn ghost" @click="cancelSelect()">取消技能</button>
          <button type="button" class="a-btn primary" @click="endPhase()">收兵（结束回合）</button>
        </template>

        <span class="a-tip" v-else>静观其变…</span>
      </div>

      <div class="hand-row">
        <span class="hand-label">我的手牌 {{ me.hand.length }} / 体力 {{ me.hp }}</span>
        <div class="hand">
          <GameCard
            v-for="c in me.hand"
            :key="c.uid"
            :card="c"
            :selected="
              selectedUid === c.uid ||
              discardPick.includes(c.uid) ||
              (skillMode && skillMode.picked.includes(c.uid))
            "
            :disabled="!canAct && !(pending && pending.kind === 'discard' && pending.idx === 0)"
            @pick="onHandCard"
          />
          <span v-if="!me.hand.length" class="empty-hand">两手空空</span>
        </div>
      </div>
    </footer>

    <!-- 结算 -->
    <div v-if="st.phase === 'over'" class="over">
      <div class="over-card">
        <h2 :class="{ win: st.winner.playerWin }">
          {{ st.winner.playerWin ? '凯旋' : '败北' }}
        </h2>
        <p class="over-text">{{ st.winner.text }}</p>
        <div class="over-roles">
          <div v-for="s in st.seats" :key="s.idx" class="or-row">
            <span class="or-name">{{ s.hero.name }}（{{ s.label }}）</span>
            <span class="or-role" :style="{ background: ROLES[s.role].color }">{{ ROLES[s.role].name }}</span>
            <span class="or-state">{{ s.alive ? '存活' : '阵亡' }}</span>
          </div>
        </div>
        <div class="over-btns">
          <button type="button" class="a-btn primary" @click="restart()">再战一局</button>
          <button type="button" class="a-btn ghost" @click="exit()">收兵回营</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--g-felt);
  color: var(--g-text);
  font-family: var(--font-body);
}

/* ---------- 顶栏 ---------- */
.g-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--g-hair);
  background: var(--g-panel);
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.b-main {
  font-family: var(--font-cal, serif);
  font-size: 20px;
  color: var(--g-gold);
  letter-spacing: 2px;
}
.b-sub {
  font-size: 12px;
  color: var(--g-faint);
}
.grow {
  flex: 1;
}
.my-role {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.mr-label {
  color: var(--g-faint);
}
.mr-val {
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff8e6;
  letter-spacing: 1px;
}
.mr-goal {
  color: var(--g-dim);
}
.t-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel-2);
  color: var(--g-text);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.t-btn:hover {
  border-color: var(--g-gold);
  color: var(--g-gold);
}

.state-box {
  padding: 60px;
  text-align: center;
  color: var(--g-dim);
}
.state-box.err {
  color: #c9513f;
}

/* ---------- 选将 ---------- */
.pick {
  flex: 1;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.pick-title {
  font-family: var(--font-cal, serif);
  font-size: 24px;
  color: var(--g-gold);
  letter-spacing: 3px;
}
.pick-tip,
.pick-foot {
  font-size: 12px;
  color: var(--g-faint);
}
.pick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
  margin: 16px 0;
}
.pick-card {
  width: 190px;
  padding: 12px 14px;
  text-align: left;
  border-radius: 10px;
  border: 1px solid var(--g-hair);
  border-top: 3px solid var(--fac);
  background: var(--g-panel);
  color: var(--g-text);
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}
.pick-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px -14px rgba(0, 0, 0, 0.7);
  border-color: var(--g-gold);
}
.pc-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.pc-name {
  font-family: var(--font-cal, serif);
  font-size: 19px;
}
.pc-fac {
  font-size: 11px;
  color: var(--fac);
}
.pc-epithet {
  font-size: 11px;
  color: var(--g-faint);
  margin-bottom: 6px;
}
.pc-hp {
  font-size: 11px;
  color: var(--g-dim);
}
.pc-skill {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.pc-type {
  margin-right: 4px;
}
.pc-sname {
  color: var(--g-text);
  margin-right: 4px;
}
.pc-sdesc {
  display: block;
  color: var(--g-faint);
  line-height: 1.6;
  margin-top: 2px;
}

/* ---------- 牌桌 ---------- */
.board {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 12px;
  padding: 12px 16px;
  min-height: 0;
}
.table {
  position: relative;
  min-height: 420px;
  border-radius: 14px;
  border: 1px solid var(--g-hair);
  background:
    radial-gradient(ellipse at 50% 45%, rgba(212, 175, 55, 0.07), transparent 62%),
    var(--g-felt);
  overflow: hidden;
}
.table :deep(.p0) {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
}
.table :deep(.p1) {
  position: absolute;
  left: 14px;
  bottom: 27%;
}
.table :deep(.p2) {
  position: absolute;
  left: 14px;
  top: 14px;
}
.table :deep(.p3) {
  position: absolute;
  right: 14px;
  top: 14px;
}
.table :deep(.p4) {
  position: absolute;
  right: 14px;
  bottom: 27%;
}
.center {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 12px;
  color: var(--g-dim);
}
.c-round {
  font-family: var(--font-cal, serif);
  font-size: 22px;
  color: var(--g-gold);
}
.c-stage {
  margin: 2px 0 4px;
  letter-spacing: 2px;
}
.c-piles {
  display: flex;
  gap: 10px;
  color: var(--g-faint);
}

/* ---------- 战报 ---------- */
.log-panel {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel);
  min-height: 0;
}
.lp-title {
  padding: 8px 10px;
  border-bottom: 1px solid var(--g-hair);
  font-size: 12px;
  color: var(--g-gold);
  letter-spacing: 2px;
}
.lp-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.75;
  color: var(--g-dim);
}
.lp-body p {
  margin-bottom: 2px;
}
.lp-body .hit {
  color: #d98b6a;
}
.lp-body .good {
  color: #7fb08a;
}
.lp-body .death {
  color: #c9513f;
}
.lp-body .warn {
  color: #d9b23a;
}
.lp-body .skill {
  color: #8fb4d9;
}
.lp-body .gold {
  color: var(--g-gold);
}

/* ---------- 底部 ---------- */
.dock {
  border-top: 1px solid var(--g-hair);
  background: var(--g-panel);
  padding: 8px 16px 12px;
}
.hint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  min-height: 20px;
}
.hint {
  color: var(--g-gold);
}
.toast {
  color: #c9513f;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  min-height: 30px;
  position: relative;
}
.pc-skills {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--g-hair);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pc-skill {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.a-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel-2);
  color: var(--g-text);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.a-btn:hover {
  border-color: var(--g-gold);
  color: var(--g-gold);
}
.a-btn.primary {
  border-color: var(--g-gold);
  color: var(--g-gold);
  background: rgba(212, 175, 55, 0.1);
}
.a-btn.skill {
  border-color: #8fb4d9;
  color: #8fb4d9;
}
.a-btn.secret {
  border-color: #b08fd9;
  color: #b08fd9;
  font-weight: 600;
}
.skill-menu {
  position: absolute;
  left: 14px;
  bottom: 120px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel);
  box-shadow: 0 18px 40px -18px #000;
}
.sm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel-2);
  color: var(--g-text);
  font-size: 12px;
  cursor: pointer;
}
.sm-item:hover {
  border-color: #8fb4d9;
}
.sm-name {
  font-weight: 600;
}
.sm-type {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(212, 175, 55, 0.14);
  color: var(--g-gold);
}
.a-btn.danger {
  border-color: #c9513f;
  color: #c9513f;
}
.a-btn.ghost {
  color: var(--g-faint);
}
.a-tip {
  font-size: 11px;
  color: var(--g-faint);
}
.hand-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}
.hand-label {
  font-size: 11px;
  color: var(--g-faint);
  white-space: nowrap;
}
.hand {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 6px 2px;
  min-height: 96px;
  align-items: flex-end;
}
.empty-hand {
  font-size: 12px;
  color: var(--g-faint);
  padding: 40px 0;
}

/* ---------- 结算 ---------- */
.over {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 6, 3, 0.72);
  z-index: 60;
}
.over-card {
  width: min(440px, 92vw);
  padding: 22px 24px;
  border-radius: 12px;
  border: 1px solid var(--g-gold);
  background: var(--g-panel);
  text-align: center;
}
.over-card h2 {
  font-family: var(--font-cal, serif);
  font-size: 30px;
  color: #c9513f;
  letter-spacing: 6px;
}
.over-card h2.win {
  color: var(--g-gold);
}
.over-text {
  margin: 8px 0 14px;
  font-size: 13px;
  color: var(--g-dim);
}
.over-roles {
  text-align: left;
  border-top: 1px dashed var(--g-hair);
  padding-top: 10px;
}
.or-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}
.or-name {
  flex: 1;
  color: var(--g-text);
}
.or-role {
  padding: 1px 7px;
  border-radius: 999px;
  color: #fff8e6;
  font-size: 11px;
}
.or-state {
  color: var(--g-faint);
  width: 34px;
  text-align: right;
}
.over-btns {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .board {
    grid-template-columns: 1fr;
  }
  .log-panel {
    max-height: 150px;
  }
  .table {
    min-height: 360px;
  }
}
</style>
