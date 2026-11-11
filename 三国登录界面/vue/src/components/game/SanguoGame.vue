<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { authHeaders, theme, toggleTheme } from '../../composables/useTheme.js'
import { heroImg, onHeroImgError } from '../../composables/useHeroImg.js'
import { useGameSocket } from '../../composables/useGameSocket.js'
import { createGame } from '../../game/engine.js'
import {
  toGameHero, ROLES, CARDS, EQUIPS, SKILL_TYPES, cardName, isDelay, isEquip
} from '../../game/rules.js'
import GameSeat from './GameSeat.vue'
import GameCard from './GameCard.vue'

const props = defineProps({
  user: { type: Object, default: null },
  /* 组队出征带进来的房号：联机时用它连 /ws/game，单机时用于席位名号与战报 */
  teamCode: { type: String, default: '' }
})
const emit = defineEmits(['exit'])

const loading = ref(true)
const error = ref('')
const heroPool = ref([])
const game = ref(null)
const logBox = ref(null)
const teamLabels = ref([])
const reportSent = ref(false)

/* ---- 联机会话 ----
 * 房主浏览器持有唯一的权威牌局；队员端只有脱敏快照 + 规则查询 + 动作代理。
 * 服务端负责席位分配、按席位分发快照、把队员动作转发给房主。 */
const online = ref(false)
const connected = ref(false)
const netError = ref('')
const mySeatIdx = ref(0)
const humanSeats = ref([0])
const isHost = ref(false)
const seatNames = ref({})
const members = ref([])
const picked = ref(false)
const picks = ref({})
const hostLost = ref(false)
let conn = null

/* 交互态 */
const selectedUid = ref(null)
const selecting = ref(null) // { card, as, candidates }
const skillMode = ref(null) // { eff, need, count, picked }
const skillMenu = ref(false) // 多技能武将的技能菜单
const discardPick = ref([])
const toastText = ref('')
let toastTimer = null

const st = computed(() => (game.value ? game.value.state : null))
const me = computed(() => (st.value ? st.value.seats[mySeatIdx.value] : null))
const pending = computed(() => (st.value ? st.value.pending : null))
const myTurn = computed(() => !!st.value && st.value.phase === 'playing' && st.value.turnIdx === mySeatIdx.value)
const selectedCard = computed(() =>
  me.value ? me.value.hand.find((c) => c.uid === selectedUid.value) || null : null
)

const STAGE_NAMES = { start: '启策', judge: '判定', draw: '征粮', play: '用兵', discard: '收兵', end: '收阵' }
const stageName = computed(() => STAGE_NAMES[st.value ? st.value.stage : ''] || '—')

/* ==================== 载入英雄榜 ==================== */

onMounted(loadHeroes)
onBeforeUnmount(() => {
  if (game.value) game.value.destroy()
  if (conn) conn.close()
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
    if (props.teamCode) {
      online.value = true
      initOnline()
    } else {
      await loadTeamLabels()
      newGame()
    }
  } catch (e) {
    error.value = '读取英雄榜失败：' + (e && e.message ? e.message : '网络异常')
  } finally {
    loading.value = false
  }
}

/* 单机开局：读取联队成员，把同袍名号挂到牌桌其余席位上 */
async function loadTeamLabels() {
  try {
    const res = await fetch('/api/team', { headers: authHeaders() })
    const body = await res.json().catch(() => null)
    const list = body && body.data && body.data.room ? body.data.room.members : []
    const me = (props.user && props.user.username) || ''
    teamLabels.value = (Array.isArray(list) ? list : [])
      .filter((m) => !m.isMe && m.username !== me)
      .map((m) => m.username)
  } catch {
    teamLabels.value = []
  }
}

/* ==================== 联机会话 ==================== */

function initOnline() {
  conn = useGameSocket({ code: props.teamCode, onMessage: onSocketMessage })
  watch(conn.connected, (v) => { connected.value = v })
  watch(conn.error, (v) => { netError.value = v })
  conn.connect()
}

function onlineOptions() {
  return {
    seatCount: 5,
    humanSeats: humanSeats.value,
    mySeatIdx: mySeatIdx.value,
    seatNames: seatNames.value,
    online: true,
    playerName: (props.user && props.user.username) || '你'
  }
}

function createOnlineGame() {
  if (game.value) game.value.destroy()
  resetUI()
  const opts = onlineOptions()
  if (isHost.value) {
    // 房主是唯一的权威牌局：状态一变就生成按席位脱敏的快照交给服务端广播
    game.value = createGame(heroPool.value, {
      ...opts,
      onSnapshot: (views) => conn && conn.send({ t: 'state', views })
    })
  } else {
    // 队员端只跑规则查询，动作一律转成协议发给房主结算
    game.value = createGame(heroPool.value, {
      ...opts,
      remote: true,
      onAction: (kind, payload) => conn && conn.send({ t: 'action', kind, ...payload })
    })
  }
}

function onSocketMessage(msg) {
  switch (msg.t) {
    case 'hello': {
      mySeatIdx.value = msg.seatIdx
      humanSeats.value = msg.humanSeats || [msg.seatIdx]
      isHost.value = !!msg.isHost
      seatNames.value = msg.seatNames || {}
      members.value = msg.members || []
      picked.value = false
      picks.value = {}
      hostLost.value = false
      createOnlineGame()
      // prepare 会触发引擎的 state 监听，自动把候选将广播给全体队员
      if (isHost.value) game.value.prepare()
      break
    }
    case 'state':
      // 房主自己就是状态源；队员用脱敏快照覆盖本地 state
      if (!isHost.value && game.value) game.value.applyView(msg.view)
      break
    case 'reset':
      if (!isHost.value) {
        picked.value = false
        picks.value = {}
        reportSent.value = false
        resetUI()
      }
      break
    case 'action': {
      // 只有房主会收到队员动作
      if (msg.kind === 'restart') { restartAsHost(); return }
      if (game.value) game.value.applyRemoteAction(msg.kind, msg)
      break
    }
    case 'pick':
      if (isHost.value) registerPick(msg.fromSeat, msg.heroId)
      break
    case 'member': {
      const list = members.value.slice()
      const hit = list.find((m) => m.seatIdx === msg.seatIdx)
      if (hit) hit.online = msg.kind === 'join'
      else list.push({ seatIdx: msg.seatIdx, username: msg.username, online: msg.kind === 'join' })
      members.value = list
      break
    }
    case 'host-lost':
      hostLost.value = true
      toast('房主已离阵，本局无法继续推进')
      break
    case 'error':
      netError.value = msg.message || '联机通道异常'
      break
    default:
      break
  }
}

/** 房主汇总全体真人的选将，收齐后统一开局，保证所有人看到同一副牌 */
function registerPick(seat, heroId) {
  if (!heroId) return
  picks.value = { ...picks.value, [seat]: heroId }
  if (humanSeats.value.every((i) => picks.value[i])) {
    game.value.start(picks.value)
  }
}

function restartAsHost() {
  picked.value = false
  picks.value = {}
  reportSent.value = false
  createOnlineGame()
  game.value.prepare()
  if (conn) conn.send({ t: 'reset' })
}

function newGame() {
  if (game.value) game.value.destroy()
  resetUI()
  reportSent.value = false
  game.value = createGame(heroPool.value, {
    seatCount: 5,
    playerName: (props.user && props.user.username) || '你',
    seatLabels: teamLabels.value
  })
  game.value.prepare()
}

/* 一局终了把战报传回联队频道：联机时只由房主上报，避免同袍刷屏 */
watch(
  () => st.value && st.value.winner,
  (winner) => {
    if (!winner || !props.teamCode || reportSent.value) return
    if (online.value && !isHost.value) return
    reportSent.value = true
    const who = (props.user && props.user.username) || '某将'
    fetch('/api/team/report', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content: `【战报】${who} 一局终了：${winner.text || '胜负已分'}` })
    }).catch(() => {})
  }
)

function resetUI() {
  selectedUid.value = null
  selecting.value = null
  skillMode.value = null
  skillMenu.value = false
  discardPick.value = []
}

function startGame(heroId) {
  resetUI()
  if (!online.value) return game.value.start(heroId)
  picked.value = true
  if (isHost.value) registerPick(mySeatIdx.value, heroId)
  else if (conn) conn.send({ t: 'pick', heroId })
}

function restart() {
  if (!online.value) return newGame()
  if (isHost.value) restartAsHost()
  else if (conn) conn.send({ t: 'action', kind: 'restart', idx: mySeatIdx.value })
}

function exit() {
  if (game.value) game.value.destroy()
  if (conn) conn.close()
  emit('exit')
}

function toast(text) {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastText.value = ''), 2200)
}

/* 出牌是「发射后不管」的异步链：引擎内部可能正等玩家响应，UI 绝不能 await，
   否则整个交互会被挂住。但仍要兜住异常，避免 unhandledrejection 静默发生。 */
function fireUseCard(card, targetIdx, as) {
  const g = game.value
  if (!g || !me.value) return
  Promise.resolve(g.useCard(me.value, card, targetIdx, as)).catch((e) => {
    console.error('[烽烟三国杀] 出牌结算异常', e)
    toast('出牌结算异常，请查看控制台')
  })
}

/* ==================== 手牌操作 ==================== */

function onHandCard(card) {
  const g = game.value
  if (!g || !me.value) return
  const p = pending.value

  /* 收兵弃牌必须放在响应分支之前：
     响应分支以「p.idx === mySeatIdx.value 就 return」收尾，写在它后面的话，玩家自己收兵时
     点手牌永远进不到 toggleDiscard，回合会卡死在弃牌这一步 */
  if (p && p.idx === mySeatIdx.value && p.kind === 'discard') return toggleDiscard(card.uid)

  // 响应阶段：直接把牌交出去
  if (p && p.idx === mySeatIdx.value) {
    if (p.kind === 'dodge' && g.canBeDodge(me.value, card)) return respond('dodge', card.uid)
    if (p.kind === 'save' && (card.key === 'heal' || (p.allowRed && ['heart', 'diamond'].includes(card.suit)))) {
      return respond('save', card.uid)
    }
    if (p.kind === 'judgeSwap') return respond('judgeSwap', card.uid)
    if (p.kind === 'negate' && card.key === 'negate') return respond('negate', card.uid)
    if (p.kind === 'duel' && g.canBeSlash(me.value, card)) return respond('duelSlash', card.uid)
    return
  }

  // 收兵弃牌（已在上方提前处理，这里兜底其他玩家的展示态）
  if (p && p.kind === 'discard') return

  // 技能需要弃牌
  if (skillMode.value && skillMode.value.need === 'cards') return toggleSkillCard(card.uid)

  if (!myTurn.value || st.value.stage !== 'play') return
  selectedUid.value = selectedUid.value === card.uid ? null : card.uid
  // 换牌 / 取消选牌后，旧的选目标态必须作废，否则高亮座位会指向另一张牌
  selecting.value = null
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
    fireUseCard(card, 0)
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
    cands = [mySeatIdx.value]
  }

  if (!cands.length) {
    toast('此刻没有合法的目标')
    return
  }
  if (cands.length === 1) {
    fireUseCard(card, cands[0], as)
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
  // 响应询问优先：此时点座位不应再触发出牌，避免两条异步链同时弹询问
  if (pending.value && pending.value.idx === mySeatIdx.value) return
  // 只在自己用兵阶段允许指定目标，回合一旦被推进就立刻收掉选目标态
  const canTarget = myTurn.value && st.value.stage === 'play'
  if (selecting.value && selecting.value.candidates.includes(seat.idx)) {
    if (!canTarget) {
      cancelSelect()
      return
    }
    const { card, as } = selecting.value
    selecting.value = null
    selectedUid.value = null
    fireUseCard(card, seat.idx, as)
    return
  }
  const m = skillMode.value
  if (m && m.need === 'target') {
    if (!canTarget) return
    if (!seat.alive) return
    if (seat.idx === mySeatIdx.value && !m.self) return
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
  const alive = st.value.seats.filter((s) => s.alive && s.idx !== mySeatIdx.value)
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

/* 收兵兜底：手牌太多/不好点时一键弃够，避免玩家停在弃牌询问里干等超时 */
function autoDiscard() {
  const p = pending.value
  if (!p || p.kind !== 'discard' || !me.value) return
  const uids = me.value.hand.slice(0, p.need).map((c) => c.uid)
  discardPick.value = []
  game.value.confirmDiscard(uids)
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
  if (p && p.idx !== mySeatIdx.value) return `${st.value.seats[p.idx].label} 正在抉择…`
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
  if (p && p.idx === mySeatIdx.value) return true
  if (!p && myTurn.value && st.value.stage === 'play') return true
  return false
})

/* 响应询问一出现就收掉选目标/技能态。selecting 是组件本地状态，引擎弹出
   挡 / 救 / 缓策询问时并不知情；旧实现里高亮座位会和响应按钮同时存在，
   玩家点座位没有反应，很像「卡死 / 无法指定目标」。 */
watch(pending, (p) => {
  if (!p) return
  selecting.value = null
  selectedUid.value = null
  skillMenu.value = false
  if (p.kind !== 'discard') skillMode.value = null
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
      <div v-if="online" class="net-bar">
        <span class="nb-code">联队 {{ teamCode }}</span>
        <span>第 {{ mySeatIdx + 1 }} 席 · {{ isHost ? '房主（权威牌局）' : '队员' }}</span>
        <span :class="['nb-state', connected ? 'ok' : 'off']">{{ connected ? '联机中' : '连接中…' }}</span>
        <span class="nb-members">{{ members.map((m) => m.username).join(' · ') }}</span>
        <span v-if="hostLost" class="nb-warn">房主已离阵，本局无法继续</span>
        <span v-if="netError" class="nb-warn">{{ netError }}</span>
      </div>
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
      <p v-if="online" class="pick-tip">
        同袍共择 · {{ picked ? '已择将，静候其余同袍…' : '全体同袍择将完毕后，由房主统一开局' }}
      </p>
      <p v-else class="pick-tip">武将悉数取自英雄榜；体力与武将技可在后台管理系统调整</p>
      <div class="pick-grid">
        <button
          v-for="h in st.candidates"
          :key="h.id"
          type="button"
          class="pick-card"
          :style="{ '--fac': h.factionColor }"
          :disabled="online && picked"
          @click="startGame(h.id)"
        >
          <div class="pc-top">
            <span class="pc-name">{{ h.name }}</span>
            <span class="pc-fac">{{ h.factionName }}</span>
          </div>
          <div class="pc-epithet">{{ h.epithet }}</div>
          <div class="pc-por">
            <span class="pc-fb" aria-hidden="true">{{ h.name.slice(0, 1) }}</span>
            <img :src="heroImg(h.name)" :alt="h.name" loading="lazy" decoding="async" @error="onHeroImgError" />
          </div>
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
          :is-me="s.idx === mySeatIdx"
          :current="st.turnIdx === s.idx && st.phase === 'playing'"
          :selectable="
            !!(selecting && selecting.candidates.includes(s.idx)) ||
            !!(skillMode && skillMode.need === 'target' && s.alive && (skillMode.self || s.idx !== mySeatIdx))
          "
          @pick="onSeatClick"
        />
        <div class="center">
          <div class="c-round">第 {{ st.round }} 轮</div>
          <div class="c-stage">{{ stageName }}阶段</div>
          <div class="c-piles">
            <span>牌堆 {{ st.deckCount ?? st.deck.length }}</span>
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
    <!-- 注意：这里是独立 v-if，不受上面 loading/error 分支保护。
         首帧 st 还是 null，必须写 st && ，否则整棵组件渲染直接抛错、页面全白 -->
    <footer v-if="st && st.phase === 'playing'" class="dock">
      <div class="hint-row">
        <span class="hint">{{ hint }}</span>
        <span v-if="toastText" class="toast">{{ toastText }}</span>
      </div>

      <div class="action-row">
        <!-- 响应 -->
        <template v-if="pending && pending.idx === mySeatIdx">
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
          <button
            v-else-if="pending.kind === 'discard'"
            type="button"
            class="a-btn primary"
            @click="autoDiscard()"
          >
            自动弃牌（{{ pending.need }} 张）
          </button>
          <span class="a-tip">点击手牌以响应</span>
        </template>

        <!-- 正在指定出牌目标：给一个明确的取消入口，别让玩家对着高亮座位干瞪眼 -->
        <template v-else-if="selecting">
          <button type="button" class="a-btn ghost" @click="cancelSelect()">取消选目标</button>
          <span class="a-tip">点击牌桌上高亮的座位指定目标</span>
        </template>

        <!-- 选中手牌后的可用动作（响应询问期间不出，避免抢答覆盖 state.pending） -->
        <template v-else-if="selectedCard && myTurn && st.stage === 'play'">
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

        <!-- 出牌阶段常规操作（有响应询问时先答题，否则点「收兵」会顶掉 pending） -->
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

        <!-- 技能菜单是独立浮层，必须放在 v-if/v-else-if 链尾：
             若用 v-if 插在链中间，后面的 v-else-if 会挂到它上面，
             响应按钮和「静观其变…」就会同时出现。 -->
        <div
          v-if="skillMenu && myTurn && st.stage === 'play' && !selectedCard && !selecting && !(pending && pending.idx === mySeatIdx)"
          class="skill-menu"
        >
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
      </div>

      <div class="hand-row">
        <span class="hand-label" v-if="me">
          <span>手牌 <b>{{ me.hand.length }}</b></span>
          <span>体力 <b>{{ me.hp }}</b></span>
        </span>
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
            :disabled="!canAct && !(pending && pending.kind === 'discard' && pending.idx === mySeatIdx)"
            @pick="onHandCard"
          />
          <span v-if="!me.hand.length" class="empty-hand">两手空空</span>
        </div>
      </div>
    </footer>

    <!-- 结算 -->
    <div v-if="st && st.phase === 'over'" class="over">
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
  /* 锁定视口高度：牌局中手牌/战报/按钮增删都不会让整页高度变化，
     否则页面滚动条一出现一消失，整个界面就会左右上下“移动” */
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: var(--g-felt);
  color: var(--g-text);
  font-family: var(--font-body);
}

/* ---------- 顶栏 ---------- */
.g-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--g-hair);
  background: var(--g-panel);
}
/* 联机状态条：整行换行，不挤占顶栏按钮 */
.net-bar {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 2px;
  font-size: 11px;
  color: var(--g-faint);
  min-width: 0;
}
.nb-code {
  color: var(--g-gold);
  letter-spacing: 1px;
}
.nb-state.ok { color: #7fb08a; }
.nb-state.off { color: #d9b23a; }
.nb-members {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nb-warn { color: #c9513f; }
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
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  scrollbar-width: thin;
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
.pick-card:disabled {
  opacity: 0.45;
  cursor: default;
}
.pick-card:disabled:hover {
  transform: none;
  box-shadow: none;
  border-color: var(--g-hair);
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
/* 选将卡片头像：固定 3:2，缺图显示姓氏占位 */
.pc-por {
  position: relative;
  margin-bottom: 6px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--g-hair);
  aspect-ratio: 3 / 2;
  background: #1b1409;
}
.pc-por img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 22%;
  display: block;
  transition: transform 0.35s var(--ease-out);
}
.pick-card:hover .pc-por img {
  transform: scale(1.06);
}
.pc-fb {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-cal, serif);
  font-size: 46px;
  color: var(--fac);
  opacity: 0.6;
  background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.07), rgba(0, 0, 0, 0.42));
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  padding: 12px 16px;
  min-height: 0;
  overflow: hidden;
}
.table {
  /* 九宫格摆座位：绝对定位 + 百分比在矮屏（1366×768 及以下）会让上下座位互相压住，
     改成网格后行列由内容撑开，任何尺寸都不会重叠，也不会再靠 transform 居中 */
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto 1fr auto;
  gap: 6px;
  padding: 14px;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid var(--g-hair);
  background:
    radial-gradient(ellipse at 50% 45%, rgba(212, 175, 55, 0.07), transparent 62%),
    var(--g-felt);
  overflow: hidden;
}
.table :deep(.p0) {
  grid-area: 3 / 2;
  justify-self: center;
  align-self: end;
}
.table :deep(.p1) {
  grid-area: 2 / 1;
  justify-self: start;
  align-self: center;
}
.table :deep(.p2) {
  grid-area: 1 / 1;
  justify-self: start;
  align-self: start;
}
.table :deep(.p3) {
  grid-area: 1 / 3;
  justify-self: end;
  align-self: start;
}
.table :deep(.p4) {
  grid-area: 2 / 3;
  justify-self: end;
  align-self: center;
}
.center {
  grid-area: 2 / 2;
  align-self: center;
  justify-self: center;
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
  overflow: hidden;
}
.lp-title {
  padding: 8px 10px;
  border-bottom: 1px solid var(--g-hair);
  font-size: 12px;
  color: var(--g-gold);
  letter-spacing: 2px;
  flex: none;
}
.lp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
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
/* 三段固定高度：提示 22 / 操作 60 / 手牌 104。
   操作区按钮数量每回合都在变，若让它撑开高度，牌桌就会随之伸缩、座位跳动 */
.dock {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-rows: 22px 60px 104px;
  gap: 6px;
  border-top: 1px solid var(--g-hair);
  background: var(--g-panel);
  padding: 8px 16px 10px;
}
.hint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.hint {
  color: var(--g-gold);
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast {
  flex: none;
  color: #c9513f;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: center;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  position: static;
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
  left: 18px;
  bottom: calc(100% + 6px);
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
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}
.hand-label {
  /* 固定宽度 + 两行：手牌数 9→10 时文字变长也不会把手牌整体往右推 */
  flex: 0 0 62px;
  width: 62px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--g-faint);
  white-space: nowrap;
}
.hand-label b {
  color: var(--g-text);
  font-weight: 600;
}
.hand {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  /* 上留 12px 给卡牌悬停上浮，下留 4px 给滚动条，手牌再多也不改变底栏高度 */
  padding: 12px 2px 4px;
  align-items: flex-end;
  scrollbar-width: thin;
}
.hand::-webkit-scrollbar,
.action-row::-webkit-scrollbar,
.lp-body::-webkit-scrollbar,
.pick::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}
.hand::-webkit-scrollbar-thumb,
.action-row::-webkit-scrollbar-thumb,
.lp-body::-webkit-scrollbar-thumb,
.pick::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.3);
}
.empty-hand {
  font-size: 12px;
  color: var(--g-faint);
  padding: 30px 0;
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
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) 150px;
  }
  .log-panel {
    max-height: 150px;
  }
  .dock {
    grid-template-rows: 22px 60px 100px;
  }
}
/* 矮屏：牌桌留出更多高度，否则上下两排座位会顶到边 */
@media (max-height: 820px) {
  .board {
    padding: 8px 12px;
    gap: 10px;
  }
  .table {
    padding: 10px;
    gap: 4px;
  }
  .dock {
    grid-template-rows: 20px 56px 96px;
    padding: 6px 12px 8px;
  }
  .hand {
    padding: 10px 2px 4px;
  }
  /* 座位整体缩一档：zoom 是布局级缩放（文字仍清晰），
     比逐个改字号/间距稳，无论武将有几个技能都等比缩小 */
  .table :deep(.seat) {
    zoom: 0.94;
  }
}
@media (max-height: 720px) {
  .dock {
    grid-template-rows: 20px 52px 90px;
  }
  .table :deep(.seat) {
    zoom: 0.86;
  }
}
</style>
