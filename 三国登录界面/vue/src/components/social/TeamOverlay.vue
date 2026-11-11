<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { socialApi } from '../../composables/useSocial'

const props = defineProps({
  code: { type: String, required: true },
  user: { type: Object, required: true }
})
const emit = defineEmits(['leave'])

const collapsed = ref(false)
const room = ref(null)
const messages = ref([])
const lastId = ref(0)
const draft = ref('')
const tip = ref('')
const logBox = ref(null)

let timer = null
let tipTimer = null

function say(text) {
  tip.value = text
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => (tip.value = ''), 2400)
}

function scrollLog() {
  nextTick(() => {
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
  })
}

async function refresh() {
  try {
    const overview = await socialApi.teamOverview()
    room.value = overview.room || null
    const data = await socialApi.loadTeamMessages(lastId.value)
    if (data.messages && data.messages.length) {
      messages.value = messages.value.concat(data.messages).slice(-120)
      scrollLog()
    }
    lastId.value = Math.max(lastId.value, Number(data.lastId) || 0)
    if (data.room) room.value = data.room
  } catch {
    /* 牌局中不打断操作，静默重试 */
  }
}

async function send() {
  const text = draft.value.trim()
  if (!text) return
  try {
    await socialApi.postTeamMessage(text)
    draft.value = ''
    await refresh()
  } catch (e) {
    say(e.message || '传令受阻')
  }
}

async function leave() {
  try {
    await socialApi.leaveTeam()
  } catch {
    /* 即便失败也让浮层收起 */
  }
  emit('leave')
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 3000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(tipTimer)
})
</script>

<template>
  <div :class="['team-overlay', { collapsed }]">
    <header class="to-head" @click="collapsed = !collapsed">
      <span class="to-title">⚔ 同袍联队</span>
      <span class="to-code">{{ code }}</span>
      <span class="to-toggle">{{ collapsed ? '展' : '收' }}</span>
    </header>

    <div v-if="!collapsed" class="to-body">
      <div class="to-members">
        <span
          v-for="m in (room && room.members ? room.members : [])"
          :key="m.username"
          :class="['to-chip', { me: m.isMe }]"
        >
          {{ m.username }}<i v-if="m.isLeader">·主</i>
        </span>
        <span v-if="!room || !room.members || !room.members.length" class="to-hint">正在聚拢同袍…</span>
      </div>
      <div class="to-hint to-seat-hint">同袍名号已列于牌桌席位，战报将传回联队频道</div>

      <div ref="logBox" class="to-log">
        <div v-if="!messages.length" class="to-hint">频道静候军令</div>
        <div v-for="m in messages" :key="m.id" :class="['to-line', m.type]">
          <b>{{ m.username }}</b>
          <span>{{ m.content }}</span>
        </div>
      </div>

      <div class="to-input">
        <input
          v-model="draft"
          type="text"
          placeholder="联队频道传令…"
          @keydown.enter="send"
          @keydown.stop
        />
        <button type="button" @click="send">传令</button>
      </div>
      <button type="button" class="to-leave" @click="leave">散队离席</button>
    </div>

    <transition name="to-fade">
      <div v-if="tip" class="to-tip">{{ tip }}</div>
    </transition>
  </div>
</template>

<style scoped>
.team-overlay {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 200;
  width: 300px;
  max-width: calc(100vw - 36px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--g-hair, rgba(212, 175, 55, 0.28));
  border-radius: 10px;
  background: var(--g-panel, linear-gradient(165deg, rgba(30, 23, 13, 0.94), rgba(17, 12, 7, 0.96)));
  color: var(--g-text, #f0e6d2);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  font-family: var(--font-body, "Noto Serif SC", serif);
  font-size: 12px;
  overflow: hidden;
}
.team-overlay.collapsed { width: 190px; }
.to-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--g-hair-soft, rgba(212, 175, 55, 0.14));
  background: var(--g-panel-2, rgba(255, 255, 255, 0.05));
}
.to-title { color: var(--g-gold, #d4af37); letter-spacing: 1px; }
.to-code { flex: 1; font-size: 11px; opacity: 0.75; letter-spacing: 1px; }
.to-toggle { font-size: 11px; opacity: 0.7; }
.to-body { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; }
.to-members { display: flex; flex-wrap: wrap; gap: 5px; }
.to-chip {
  padding: 2px 8px;
  border: 1px solid var(--g-hair-soft, rgba(212, 175, 55, 0.14));
  border-radius: 999px;
  font-size: 11px;
}
.to-chip.me { border-color: var(--g-gold, #d4af37); color: var(--g-gold, #d4af37); }
.to-chip i { font-style: normal; opacity: 0.7; }
.to-hint { font-size: 10px; opacity: 0.6; line-height: 1.5; }
.to-seat-hint { border-left: 2px solid var(--g-gold, #d4af37); padding-left: 6px; }
.to-log {
  height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px 2px;
}
.to-line { display: flex; gap: 5px; flex-wrap: wrap; line-height: 1.5; }
.to-line b { color: var(--g-gold, #d4af37); font-weight: 500; }
.to-line.system { color: var(--g-gold, #d4af37); opacity: 0.85; }
.to-line.report { color: #e8b06a; }
.to-line span { flex: 1; word-break: break-word; }
.to-input { display: flex; gap: 6px; }
.to-input input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--g-hair-soft, rgba(212, 175, 55, 0.14));
  border-radius: 5px;
  background: var(--g-panel-2, rgba(255, 255, 255, 0.05));
  color: inherit;
  font-family: inherit;
  font-size: 11px;
  outline: none;
}
.to-input input:focus { border-color: var(--g-gold, #d4af37); }
.to-input button, .to-leave {
  padding: 6px 10px;
  border: 1px solid var(--g-hair, rgba(212, 175, 55, 0.28));
  border-radius: 5px;
  background: transparent;
  color: var(--g-gold, #d4af37);
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
}
.to-leave { align-self: flex-start; opacity: 0.72; }
.to-input button:hover, .to-leave:hover { background: var(--g-panel-2, rgba(255, 255, 255, 0.05)); }
.to-tip {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(20, 13, 8, 0.95);
  color: var(--g-gold, #d4af37);
  font-size: 11px;
  white-space: nowrap;
}
.to-fade-enter-active, .to-fade-leave-active { transition: opacity 0.25s ease; }
.to-fade-enter-from, .to-fade-leave-to { opacity: 0; }
@media (max-width: 700px) {
  .team-overlay { right: 10px; bottom: 10px; width: 250px; }
}
</style>
