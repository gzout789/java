<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { socialApi } from '../../composables/useSocial'

const props = defineProps({
  open: { type: Boolean, default: false },
  user: { type: Object, required: true }
})
const emit = defineEmits(['close', 'enter-game', 'unauthorized', 'badge'])

const TABS = [
  { key: 'friends', label: '同袍' },
  { key: 'chat', label: '私信' },
  { key: 'team', label: '联队' }
]
const tab = ref('friends')

const friends = ref([])
const requests = ref([])
const unreadTotal = ref(0)
const keyword = ref('')
const searchResults = ref([])
const searching = ref(false)
const confirmRemove = ref('')

const activeChat = ref('')
const chatMessages = ref([])
const chatLastId = ref(0)
const chatDraft = ref('')
const chatBox = ref(null)

const room = ref(null)
const invites = ref([])
const teamMessages = ref([])
const teamLastId = ref(0)
const teamDraft = ref('')
const teamName = ref('同袍联队')
const joinCode = ref('')
const teamBox = ref(null)

const toastText = ref('')
const startedCode = ref('')

let overviewTimer = null
let chatTimer = null
let teamTimer = null
let toastTimer = null

const incomingCount = computed(
  () => requests.value.filter((r) => r.direction === 'in').length
)
const invitableFriends = computed(() => {
  const inRoom = new Set((room.value && room.value.members ? room.value.members : []).map((m) => m.username))
  return friends.value.filter((f) => !inRoom.has(f.username))
})
const isLeader = computed(() => {
  if (!room.value || !room.value.members) return false
  const me = room.value.members.find((m) => m.isMe)
  return !!(me && me.isLeader)
})

function toast(text) {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastText.value = ''), 2600)
}

function handleErr(e) {
  if (e && e.unauthorized) {
    emit('unauthorized')
    return
  }
  toast((e && e.message) || '军中传令受阻，请稍后再试')
}

function enterGame(code) {
  if (!code || startedCode.value === code) return
  startedCode.value = code
  emit('enter-game', code)
}

/* ---------------- 轮询 ---------------- */
async function refreshOverview() {
  try {
    const data = await socialApi.overview()
    friends.value = data.friends || []
    requests.value = data.requests || []
    unreadTotal.value = data.unreadTotal || 0
  } catch (e) {
    handleErr(e)
  }
  try {
    const data = await socialApi.teamOverview()
    room.value = data.room || null
    invites.value = data.invites || []
    if (room.value && room.value.status === 'playing') {
      enterGame(room.value.code)
    } else {
      startedCode.value = ''
    }
  } catch (e) {
    handleErr(e)
  }
  emit('badge', unreadTotal.value + incomingCount.value + invites.value.length)
}

async function loadChat(reset = false) {
  if (!activeChat.value) return
  if (reset) {
    chatMessages.value = []
    chatLastId.value = 0
  }
  try {
    const data = await socialApi.loadMessages(activeChat.value, chatLastId.value)
    if (data.messages && data.messages.length) {
      chatMessages.value = chatMessages.value.concat(data.messages)
      scrollChat()
    }
    chatLastId.value = Math.max(chatLastId.value, Number(data.lastId) || 0)
  } catch (e) {
    handleErr(e)
  }
}

async function loadTeamMessages(reset = false) {
  if (reset) {
    teamMessages.value = []
    teamLastId.value = 0
  }
  try {
    const data = await socialApi.loadTeamMessages(teamLastId.value)
    if (data.messages && data.messages.length) {
      teamMessages.value = teamMessages.value.concat(data.messages)
      scrollTeam()
    }
    teamLastId.value = Math.max(teamLastId.value, Number(data.lastId) || 0)
    if (data.room) room.value = data.room
  } catch (e) {
    handleErr(e)
  }
}

function scrollChat() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}
function scrollTeam() {
  nextTick(() => {
    if (teamBox.value) teamBox.value.scrollTop = teamBox.value.scrollHeight
  })
}

onMounted(() => {
  /* 面板收起时也保持轮询：队员不必开着面板，照样能收到「整队出征」一起入局 */
  overviewTimer = setInterval(refreshOverview, 3000)
  chatTimer = setInterval(() => {
    if (props.open && tab.value === 'chat' && activeChat.value) loadChat()
  }, 2000)
  teamTimer = setInterval(() => {
    if (props.open && tab.value === 'team' && room.value) loadTeamMessages()
  }, 2500)
  refreshOverview()
})

watch(() => props.open, (v) => {
  if (v) refreshOverview()
})

onBeforeUnmount(() => {
  clearInterval(overviewTimer)
  clearInterval(chatTimer)
  clearInterval(teamTimer)
  clearTimeout(toastTimer)
})

watch(tab, (v) => {
  if (v === 'chat' && activeChat.value) loadChat()
  if (v === 'team' && room.value) loadTeamMessages()
})

/* ---------------- 好友 ---------------- */
async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    searchResults.value = await socialApi.search(kw)
  } catch (e) {
    handleErr(e)
  } finally {
    searching.value = false
  }
}

async function requestFriend(username) {
  try {
    await socialApi.addRequest(username, '')
    toast('结交帖已递出，静候回音')
    await refreshOverview()
    await doSearch()
  } catch (e) {
    handleErr(e)
  }
}

async function handleRequest(id, accept) {
  try {
    await (accept ? socialApi.acceptRequest(id) : socialApi.rejectRequest(id))
    toast(accept ? '已结为同袍' : '已婉拒此帖')
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function removeFriend(username) {
  try {
    await socialApi.removeFriend(username)
    confirmRemove.value = ''
    toast('已断交')
    if (activeChat.value === username) activeChat.value = ''
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

/* ---------------- 私信 ---------------- */
function openChat(username) {
  activeChat.value = username
  tab.value = 'chat'
  loadChat(true)
}

async function sendChat() {
  const text = chatDraft.value.trim()
  if (!text || !activeChat.value) return
  try {
    await socialApi.sendMessage(activeChat.value, text)
    chatDraft.value = ''
    await loadChat()
  } catch (e) {
    handleErr(e)
  }
}

/* ---------------- 联队 ---------------- */
async function createTeam() {
  try {
    await socialApi.createTeam(teamName.value)
    toast('联队已立，可邀同袍')
    await loadTeamMessages(true)
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function joinByCode() {
  const code = joinCode.value.trim()
  if (!code) return toast('请填写房号')
  try {
    await socialApi.joinTeam(code)
    joinCode.value = ''
    toast('已入联队')
    await loadTeamMessages(true)
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function inviteToTeam(username) {
  try {
    await socialApi.invite(username)
    toast('请帖已送达 ' + username)
    await loadTeamMessages(true)
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function handleInvite(id, accept) {
  try {
    await (accept ? socialApi.acceptInvite(id) : socialApi.rejectInvite(id))
    toast(accept ? '已加入联队' : '已婉拒组队')
    await loadTeamMessages(true)
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function leaveTeam() {
  try {
    await socialApi.leaveTeam()
    room.value = null
    teamMessages.value = []
    teamLastId.value = 0
    toast('已离队')
    await refreshOverview()
  } catch (e) {
    handleErr(e)
  }
}

async function startTeam() {
  try {
    await socialApi.startTeam()
    toast('擂鼓整队，共赴烽烟！')
    await refreshOverview()
    const code = room.value && room.value.code
    if (code) enterGame(code)
  } catch (e) {
    handleErr(e)
  }
}

async function sendTeamMessage() {
  const text = teamDraft.value.trim()
  if (!text) return
  try {
    await socialApi.postTeamMessage(text)
    teamDraft.value = ''
    await loadTeamMessages()
  } catch (e) {
    handleErr(e)
  }
}

function factionLabel(f) {
  return ({ han: '汉', wei: '魏', shu: '蜀', wu: '吴' })[f] || '汉'
}
</script>

<template>
  <div v-if="open" class="social-root">
    <div class="social-mask" @click="emit('close')"></div>
    <aside class="social-drawer" role="dialog" aria-label="同袍与联队">
      <header class="sd-head">
        <div>
          <div class="sd-title">同袍 · 联队</div>
          <div class="sd-sub">{{ user.username }} 帐下</div>
        </div>
        <button type="button" class="sd-close" aria-label="收起" @click="emit('close')">✕</button>
      </header>

      <nav class="sd-tabs">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          :class="['sd-tab', { active: tab === t.key }]"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span v-if="t.key === 'friends' && unreadTotal" class="sd-badge">{{ unreadTotal }}</span>
          <span v-else-if="t.key === 'team' && invites.length" class="sd-badge">{{ invites.length }}</span>
        </button>
      </nav>

      <div class="sd-body">
        <!-- ============ 同袍 ============ -->
        <section v-if="tab === 'friends'" class="sd-pane">
          <div class="sd-search">
            <input
              v-model="keyword"
              type="text"
              placeholder="输入将军名号，寻访同袍…"
              @keydown.enter="doSearch"
            />
            <button type="button" @click="doSearch">{{ searching ? '寻访中' : '寻访' }}</button>
          </div>

          <div v-if="searchResults.length" class="sd-block">
            <div class="sd-label">寻访结果</div>
            <div v-for="u in searchResults" :key="u.username" class="sd-row">
              <span class="sd-seal" :data-f="u.faction">{{ u.username.slice(0, 1) }}</span>
              <div class="sd-row-main">
                <b>{{ u.username }}</b>
                <small>{{ u.factionName }}</small>
              </div>
              <button v-if="u.isFriend" type="button" class="sd-mini" disabled>已同袍</button>
              <button v-else-if="u.pending" type="button" class="sd-mini" disabled>候回音</button>
              <button v-else type="button" class="sd-mini primary" @click="requestFriend(u.username)">递帖</button>
            </div>
          </div>

          <div class="sd-block">
            <div class="sd-label">结交帖 <span v-if="incomingCount">· {{ incomingCount }} 待应</span></div>
            <div v-if="!requests.length" class="sd-empty">暂无往来帖子</div>
            <div v-for="r in requests" :key="r.id" class="sd-row">
              <span class="sd-seal">{{ (r.direction === 'in' ? r.fromUsername : r.toUsername).slice(0, 1) }}</span>
              <div class="sd-row-main">
                <b>{{ r.direction === 'in' ? r.fromUsername : r.toUsername }}</b>
                <small>{{ r.direction === 'in' ? '递帖于你' : '候对方回音' }}{{ r.message ? ' · ' + r.message : '' }}</small>
              </div>
              <template v-if="r.direction === 'in'">
                <button type="button" class="sd-mini primary" @click="handleRequest(r.id, true)">应允</button>
                <button type="button" class="sd-mini" @click="handleRequest(r.id, false)">婉拒</button>
              </template>
              <span v-else class="sd-tag">{{ r.time }}</span>
            </div>
          </div>

          <div class="sd-block">
            <div class="sd-label">同袍名录 <span>· {{ friends.length }} 员</span></div>
            <div v-if="!friends.length" class="sd-empty">尚未结交同袍，先去寻访吧</div>
            <div v-for="f in friends" :key="f.username" class="sd-row">
              <span class="sd-seal" :data-f="f.faction">{{ factionLabel(f.faction) }}</span>
              <div class="sd-row-main">
                <b>{{ f.username }}<i v-if="f.unread" class="sd-dot"></i></b>
                <small>{{ f.factionName }}{{ f.unread ? ' · ' + f.unread + ' 封未读' : '' }}</small>
              </div>
              <button type="button" class="sd-mini primary" @click="openChat(f.username)">叙话</button>
              <button type="button" class="sd-mini" @click="confirmRemove = f.username">断交</button>
              <div v-if="confirmRemove === f.username" class="sd-confirm">
                确认与 {{ f.username }} 断交？
                <button type="button" class="sd-mini primary" @click="removeFriend(f.username)">确认</button>
                <button type="button" class="sd-mini" @click="confirmRemove = ''">取消</button>
              </div>
            </div>
          </div>
        </section>

        <!-- ============ 私信 ============ -->
        <section v-else-if="tab === 'chat'" class="sd-pane sd-pane-chat">
          <div v-if="!activeChat" class="sd-pick">
            <div class="sd-empty">点一位同袍，开始叙话</div>
            <button
              v-for="f in friends"
              :key="f.username"
              type="button"
              class="sd-pick-item"
              @click="openChat(f.username)"
            >
              <span class="sd-seal" :data-f="f.faction">{{ factionLabel(f.faction) }}</span>
              {{ f.username }}
              <i v-if="f.unread" class="sd-dot"></i>
            </button>
            <div v-if="!friends.length" class="sd-empty">同袍名录尚空</div>
          </div>
          <template v-else>
            <div class="sd-chat-head">
              <span>与 <b>{{ activeChat }}</b> 叙话</span>
              <button type="button" class="sd-mini" @click="activeChat = ''">换人</button>
            </div>
            <div ref="chatBox" class="sd-chat-box">
              <div v-if="!chatMessages.length" class="sd-empty">尚无往来书信，先道一声安好</div>
              <div
                v-for="m in chatMessages"
                :key="m.id"
                :class="['sd-bubble', m.mine ? 'mine' : 'theirs']"
              >
                <div class="sd-bubble-text">{{ m.content }}</div>
                <div class="sd-bubble-time">{{ m.mine ? '我' : m.fromUsername }} · {{ m.time }}</div>
              </div>
            </div>
            <div class="sd-input">
              <input
                v-model="chatDraft"
                type="text"
                placeholder="修书一封…"
                @keydown.enter="sendChat"
              />
              <button type="button" class="sd-mini primary" @click="sendChat">送达</button>
            </div>
          </template>
        </section>

        <!-- ============ 联队 ============ -->
        <section v-else class="sd-pane sd-pane-team">
          <template v-if="!room">
            <div class="sd-label">自立联队</div>
            <div class="sd-search">
              <input v-model="teamName" type="text" placeholder="联队名号" maxlength="40" />
              <button type="button" @click="createTeam">建队</button>
            </div>
            <div class="sd-or">或凭房号投奔同袍</div>
            <div class="sd-search">
              <input v-model="joinCode" type="text" placeholder="六位房号" maxlength="12" />
              <button type="button" @click="joinByCode">入队</button>
            </div>
          </template>

          <template v-else>
            <div class="sd-room-head">
              <div class="sd-room-name">{{ room.name }}</div>
              <div class="sd-room-code">房号 <b>{{ room.code }}</b></div>
              <span :class="['sd-status', room.status]">
                {{ room.status === 'playing' ? '已出征' : '候同袍' }}
              </span>
            </div>

            <div class="sd-label">队中同袍 <span>· {{ room.members.length }}/5</span></div>
            <div class="sd-members">
              <span v-for="m in room.members" :key="m.username" :class="['sd-chip', { me: m.isMe }]">
                {{ m.username }}<i v-if="m.isLeader">·主</i>
              </span>
            </div>

            <div v-if="invitableFriends.length && room.status === 'waiting'" class="sd-block">
              <div class="sd-label">邀同袍入列</div>
              <div class="sd-invite-row">
                <button
                  v-for="f in invitableFriends"
                  :key="f.username"
                  type="button"
                  class="sd-mini primary"
                  @click="inviteToTeam(f.username)"
                >
                  邀 {{ f.username }}
                </button>
              </div>
            </div>

            <div ref="teamBox" class="sd-chat-box sd-room-log">
              <div v-if="!teamMessages.length" class="sd-empty">联队频道静候军令</div>
              <div v-for="m in teamMessages" :key="m.id" :class="['sd-log-line', m.type]">
                <span class="sd-log-who">{{ m.username }}</span>
                <span class="sd-log-text">{{ m.content }}</span>
                <span class="sd-log-time">{{ m.time }}</span>
              </div>
            </div>
            <div class="sd-input">
              <input
                v-model="teamDraft"
                type="text"
                placeholder="联队频道传令…"
                @keydown.enter="sendTeamMessage"
              />
              <button type="button" class="sd-mini primary" @click="sendTeamMessage">传令</button>
            </div>

            <div class="sd-actions">
              <button
                v-if="isLeader && room.status === 'waiting'"
                type="button"
                class="sd-start"
                @click="startTeam"
              >
                ⚔ 整队出征 · 共入烽烟
              </button>
              <span v-else-if="room.status === 'playing'" class="sd-tag">已出征，正同赴牌局</span>
              <button type="button" class="sd-mini" @click="leaveTeam">离队</button>
            </div>
          </template>

          <div class="sd-block">
            <div class="sd-label">递来的请帖 <span v-if="invites.length">· {{ invites.length }}</span></div>
            <div v-if="!invites.length" class="sd-empty">暂无组队请帖</div>
            <div v-for="i in invites" :key="i.id" class="sd-row">
              <span class="sd-seal">帖</span>
              <div class="sd-row-main">
                <b>{{ i.fromUsername }}</b>
                <small>邀你入「{{ i.roomName }}」· {{ i.roomCode }}</small>
              </div>
              <button type="button" class="sd-mini primary" @click="handleInvite(i.id, true)">应允</button>
              <button type="button" class="sd-mini" @click="handleInvite(i.id, false)">婉拒</button>
            </div>
          </div>
        </section>
      </div>

      <transition name="sd-fade">
        <div v-if="toastText" class="sd-toast">{{ toastText }}</div>
      </transition>
    </aside>
  </div>
</template>

<style scoped>
.social-root {
  position: fixed;
  inset: 0;
  z-index: 80;
  font-family: var(--font-body, "Noto Serif SC", serif);
  color: var(--text, #f3e9d6);
}
.social-mask {
  position: absolute;
  inset: 0;
  background: rgba(8, 5, 3, 0.58);
  backdrop-filter: blur(2px);
}
.social-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  display: flex;
  flex-direction: column;
  background: var(--surface-panel, linear-gradient(160deg, rgba(30, 23, 18, 0.98), rgba(22, 15, 10, 0.98)));
  border-left: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
  box-shadow: -18px 0 60px rgba(0, 0, 0, 0.55);
  animation: sdIn 0.28s var(--ease-out, ease-out);
}
@keyframes sdIn {
  from { transform: translateX(30px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.sd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
}
.sd-title {
  font-size: 20px;
  letter-spacing: 3px;
  color: var(--gold, #d4af37);
}
.sd-sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-mute, rgba(243, 233, 214, 0.55));
}
.sd-close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
  border-radius: 50%;
  background: transparent;
  color: var(--text-dim, rgba(243, 233, 214, 0.68));
  cursor: pointer;
  font-size: 14px;
}
.sd-close:hover { color: var(--gold, #d4af37); border-color: var(--gold, #d4af37); }

.sd-tabs {
  display: flex;
  border-bottom: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
}
.sd-tab {
  flex: 1;
  position: relative;
  padding: 11px 4px;
  border: 0;
  background: transparent;
  color: var(--text-mute, rgba(243, 233, 214, 0.55));
  font-size: 14px;
  letter-spacing: 2px;
  cursor: pointer;
}
.sd-tab.active { color: var(--gold, #d4af37); }
.sd-tab.active::after {
  content: '';
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: -1px;
  height: 2px;
  background: var(--gold, #d4af37);
}
.sd-badge {
  display: inline-block;
  min-width: 16px;
  padding: 0 4px;
  margin-left: 4px;
  border-radius: 999px;
  background: var(--primary, #b22222);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  letter-spacing: 0;
}

.sd-body { flex: 1; overflow-y: auto; padding: 16px 18px 24px; }
.sd-pane { display: flex; flex-direction: column; gap: 14px; }
.sd-pane-chat, .sd-pane-team { min-height: 100%; }
.sd-block { display: flex; flex-direction: column; gap: 8px; }
.sd-label {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--gold-soft, #e8c86a);
  border-left: 2px solid var(--gold, #d4af37);
  padding-left: 8px;
}
.sd-label span { color: var(--text-faint, rgba(243, 233, 214, 0.45)); letter-spacing: 0; }
.sd-empty {
  padding: 12px 4px;
  font-size: 12px;
  color: var(--text-faint, rgba(243, 233, 214, 0.45));
  text-align: center;
}

.sd-search { display: flex; gap: 8px; }
.sd-search input, .sd-input input {
  flex: 1;
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  border-radius: var(--r-sm, 6px);
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
  color: var(--text, #f3e9d6);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}
.sd-search input:focus, .sd-input input:focus { border-color: var(--gold, #d4af37); }
.sd-search input::placeholder, .sd-input input::placeholder { color: var(--text-faint, rgba(243, 233, 214, 0.45)); }
.sd-search > button {
  padding: 0 14px;
  border: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
  border-radius: var(--r-sm, 6px);
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
  color: var(--gold, #d4af37);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  white-space: nowrap;
}
.sd-search > button:hover { background: rgba(212, 175, 55, 0.14); }

.sd-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  padding: 8px 9px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  border-radius: var(--r-sm, 6px);
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
}
.sd-seal {
  flex: none;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
  border-radius: 4px;
  color: var(--gold, #d4af37);
  font-size: 14px;
  background: rgba(178, 34, 34, 0.18);
}
.sd-seal[data-f="wei"] { background: rgba(47, 111, 176, 0.2); }
.sd-seal[data-f="shu"] { background: rgba(46, 139, 87, 0.2); }
.sd-seal[data-f="wu"] { background: rgba(31, 158, 143, 0.2); }
.sd-row-main { flex: 1; min-width: 90px; display: flex; flex-direction: column; gap: 2px; }
.sd-row-main b { font-size: 14px; font-weight: 500; }
.sd-row-main small {
  font-size: 11px;
  color: var(--text-mute, rgba(243, 233, 214, 0.55));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sd-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--primary, #b22222);
  vertical-align: middle;
}
.sd-mini {
  padding: 4px 9px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  border-radius: 999px;
  background: transparent;
  color: var(--text-dim, rgba(243, 233, 214, 0.68));
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  white-space: nowrap;
}
.sd-mini:hover:not(:disabled) { border-color: var(--gold, #d4af37); color: var(--gold, #d4af37); }
.sd-mini:disabled { opacity: 0.45; cursor: default; }
.sd-mini.primary {
  border-color: var(--primary, #b22222);
  background: rgba(178, 34, 34, 0.22);
  color: var(--gold-soft, #e8c86a);
}
.sd-tag { font-size: 11px; color: var(--text-faint, rgba(243, 233, 214, 0.45)); }
.sd-confirm {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--hair-soft, rgba(212, 175, 55, 0.18));
  font-size: 11px;
  color: var(--text-dim, rgba(243, 233, 214, 0.68));
}

/* 私信 */
.sd-pick { display: flex; flex-direction: column; gap: 8px; }
.sd-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  border-radius: var(--r-sm, 6px);
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
  color: var(--text, #f3e9d6);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
}
.sd-pick-item:hover { border-color: var(--gold, #d4af37); }
.sd-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  font-size: 13px;
}
.sd-chat-head b { color: var(--gold, #d4af37); font-weight: 500; }
.sd-chat-box {
  flex: 1;
  min-height: 240px;
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px 2px;
}
.sd-bubble { max-width: 86%; display: flex; flex-direction: column; gap: 3px; }
.sd-bubble.mine { align-self: flex-end; align-items: flex-end; }
.sd-bubble.theirs { align-self: flex-start; }
.sd-bubble-text {
  padding: 8px 11px;
  border-radius: 10px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  background: var(--surface-soft, rgba(243, 233, 214, 0.06));
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}
.sd-bubble.mine .sd-bubble-text {
  border-color: rgba(178, 34, 34, 0.5);
  background: rgba(178, 34, 34, 0.24);
}
.sd-bubble-time { font-size: 10px; color: var(--text-faint, rgba(243, 233, 214, 0.45)); }
.sd-input { display: flex; gap: 8px; }

/* 联队 */
.sd-room-head {
  position: relative;
  padding: 12px 14px;
  border: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
  border-radius: var(--r-sm, 6px);
  background: rgba(178, 34, 34, 0.12);
}
.sd-room-name { font-size: 16px; letter-spacing: 2px; }
.sd-room-code { margin-top: 4px; font-size: 12px; color: var(--text-mute, rgba(243, 233, 214, 0.55)); }
.sd-room-code b { color: var(--gold, #d4af37); letter-spacing: 2px; }
.sd-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  border: 1px solid var(--hair, rgba(212, 175, 55, 0.4));
}
.sd-status.playing { color: var(--gold, #d4af37); border-color: var(--gold, #d4af37); }
.sd-members { display: flex; flex-wrap: wrap; gap: 6px; }
.sd-chip {
  padding: 4px 10px;
  border: 1px solid var(--hair-soft, rgba(212, 175, 55, 0.18));
  border-radius: 999px;
  font-size: 12px;
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
}
.sd-chip.me { border-color: var(--gold, #d4af37); color: var(--gold, #d4af37); }
.sd-chip i { font-style: normal; font-size: 10px; opacity: 0.8; }
.sd-invite-row { display: flex; flex-wrap: wrap; gap: 6px; }
.sd-or { text-align: center; font-size: 11px; color: var(--text-faint, rgba(243, 233, 214, 0.45)); }
.sd-room-log { min-height: 150px; max-height: 30vh; gap: 5px; }
.sd-log-line {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 12px;
  line-height: 1.5;
  padding: 5px 7px;
  border-radius: 5px;
  background: var(--surface-soft, rgba(243, 233, 214, 0.04));
}
.sd-log-line.system { color: var(--gold-soft, #e8c86a); background: transparent; }
.sd-log-line.report { border-left: 2px solid var(--primary, #b22222); }
.sd-log-who { color: var(--gold, #d4af37); }
.sd-log-text { flex: 1; word-break: break-word; }
.sd-log-time { color: var(--text-faint, rgba(243, 233, 214, 0.45)); font-size: 10px; }
.sd-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sd-start {
  flex: 1;
  min-width: 190px;
  padding: 11px 14px;
  border: 1px solid var(--gold, #d4af37);
  border-radius: var(--r-sm, 6px);
  background: linear-gradient(135deg, rgba(178, 34, 34, 0.5), rgba(122, 20, 20, 0.55));
  color: #f7ecd4;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 2px;
}
.sd-start:hover { box-shadow: 0 6px 18px -6px var(--accent-glow, rgba(178, 34, 34, 0.7)); }

.sd-toast {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  padding: 9px 18px;
  border: 1px solid var(--gold, #d4af37);
  border-radius: 999px;
  background: rgba(20, 13, 8, 0.95);
  color: var(--gold-soft, #e8c86a);
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.sd-fade-enter-active, .sd-fade-leave-active { transition: opacity 0.25s ease; }
.sd-fade-enter-from, .sd-fade-leave-to { opacity: 0; }

@media (max-width: 520px) {
  .social-drawer { width: 100vw; }
  .sd-chat-box { max-height: 52vh; }
}
</style>
