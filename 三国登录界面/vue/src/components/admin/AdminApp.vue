<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTheme } from '../../composables/useTheme'
import { adminFetch, setAdminSession } from '../../composables/useAdmin'

defineProps({
  admin: { type: Object, required: true }
})
const emit = defineEmits(['logout', 'back'])

const { theme, toggleTheme } = useTheme()

/* ==================== 模块路由 ==================== */
const MODULES = [
  { key: 'heroes', label: '英雄榜', icon: '⚔' },
  { key: 'tasks', label: '军机要务', icon: '📜' },
  { key: 'news', label: '烽火快报', icon: '🔥' },
  { key: 'quiz', label: '学识题库', icon: '📖' },
  { key: 'users', label: '将军账号', icon: '👤' }
]
const activeModule = ref('heroes')

function switchModule(key) {
  if (activeModule.value === key) return
  activeModule.value = key
  loadCurrent()
}

const MODULE_META = {
  heroes: { title: '英雄榜数据管理', sub: '此处改动会直接反映到前台首页「英雄榜」' },
  tasks: { title: '军机要务管理', sub: '维护前台首页「军机要务」的内容与状态' },
  news: { title: '烽火快报管理', sub: '维护前台首页「烽火快报」的军情内容' },
  quiz: { title: '学识题库管理', sub: '维护「学识问道」的历史知识与答题奖励' },
  users: { title: '将军账号管理', sub: '维护前台将军账号、阵营与密码' }
}
const currentTitle = computed(() => (MODULE_META[activeModule.value] || {}).title || '后台管理')
const currentSub = computed(() => (MODULE_META[activeModule.value] || {}).sub || '')

/** 题目选项文本（列表里展示答案对应的选项内容） */
function optionText(q, key) {
  if (!key) return ''
  const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
  return map[key] || ''
}

/* ==================== 通用：提示 / 请求 ==================== */
function toast(msg, ok = true) {
  toastMsg.value = msg
  toastOk.value = ok
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2600)
}
const toastMsg = ref('')
const toastOk = ref(true)
let toastTimer = null

function handleExpired() {
  setAdminSession(null)
  emit('logout', '管理凭信已失效，请重新登录')
}

async function get(url) {
  const { status, body } = await adminFetch(url)
  if (status === 401) {
    handleExpired()
    return { expired: true }
  }
  if (status === 0 || !body) {
    toast('与后端失联，请确认 8081 服务是否在运行', false)
    return { error: true }
  }
  return { body }
}

async function send(url, method, payload) {
  const { status, body } = await adminFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (status === 401) {
    handleExpired()
    return { expired: true }
  }
  if (status === 0 || !body) {
    return { error: true, msg: '与后端失联，操作失败' }
  }
  return { body }
}

/* ==================== 看板 ==================== */
const meta = ref({
  total: 0, factions: [], types: [], typeOptions: [], avgPower: 0, topHero: '',
  skillTypes: [], taskCount: 0, newsCount: 0, quizCount: 0, userCount: 0, recruitCount: 0, gachaCount: 0
})
async function loadMeta() {
  const r = await get('/api/admin/meta')
  if (r.body && r.body.success) meta.value = r.body.data
}

const factionOptions = computed(() => {
  const list = meta.value.factions && meta.value.factions.length
    ? meta.value.factions
    : [
        { key: 'han', name: '汉室', count: 0 },
        { key: 'wei', name: '曹魏', count: 0 },
        { key: 'shu', name: '蜀汉', count: 0 },
        { key: 'wu', name: '东吴', count: 0 }
      ]
  return [{ key: 'all', name: '全部', count: meta.value.total }, ...list]
})
const typeOptions = computed(() => {
  const list = meta.value.types || []
  return [{ key: 'all', name: '全部', count: meta.value.total }, ...list]
})
const formTypeOptions = computed(() => meta.value.typeOptions || ['君主', '军师', '猛将', '统帅'])
const skillTypeOptions = computed(() => meta.value.skillTypes || ['常策', '奇谋', '应策', '秘计'])

function factionName(key) {
  const hit = (meta.value.factions || []).find((f) => f.key === key)
  return hit ? hit.name : key || '—'
}
const FACTION_SHORT = { han: '汉', wei: '魏', shu: '蜀', wu: '吴' }
function factionShort(key) {
  return FACTION_SHORT[key] || '·'
}

/* ==================== 英雄榜 ==================== */
const heroes = ref([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const faction = ref('all')
const type = ref('all')
let searchTimer = null

function query() {
  const params = new URLSearchParams()
  if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
  if (faction.value !== 'all') params.set('faction', faction.value)
  if (type.value !== 'all') params.set('type', type.value)
  return params.toString()
}

async function loadHeroes() {
  loading.value = true
  const { status, body } = await adminFetch('/api/admin/heroes?' + query())
  loading.value = false
  if (status === 401) {
    handleExpired()
    return
  }
  if (status === 0 || !body) {
    loadError.value = '与后端失联，请确认 8081 服务是否在运行'
    return
  }
  loadError.value = ''
  if (body.success) heroes.value = body.data || []
  else toast(body.message || '读取英雄榜失败', false)
}

function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadHeroes(), 320)
}
function pickFaction(key) {
  faction.value = key
  loadHeroes()
}
function pickType(name) {
  type.value = name
  loadHeroes()
}
function resetFilters() {
  keyword.value = ''
  faction.value = 'all'
  type.value = 'all'
  loadHeroes()
}

/* 英雄榜弹窗（含体力 / 武将技） */
const modal = ref({ open: false, mode: 'create', heroId: null })
const form = ref(emptyForm())
const formError = ref('')
const saving = ref(false)
const nameInput = ref(null)

function emptyForm() {
  return {
    name: '', epithet: '', faction: 'shu', type: '猛将',
    power: 80, leadership: 80, sortOrder: null, description: '',
    hp: null, skillName: '', skillType: '', skillDesc: ''
  }
}

async function openCreate() {
  form.value = emptyForm()
  formError.value = ''
  modal.value = { open: true, mode: 'create', heroId: null }
  await nextTick()
  if (nameInput.value) nameInput.value.focus()
}

async function openEdit(hero) {
  form.value = {
    name: hero.name || '', epithet: hero.epithet || '', faction: hero.faction || 'han',
    type: hero.type || '猛将', power: hero.power, leadership: hero.leadership,
    sortOrder: hero.sortOrder, description: hero.description || '',
    hp: hero.hp ?? null, skillName: hero.skillName || '', skillType: hero.skillType || '',
    skillDesc: hero.skillDesc || ''
  }
  formError.value = ''
  modal.value = { open: true, mode: 'edit', heroId: hero.id }
  await nextTick()
  if (nameInput.value) nameInput.value.focus()
}

function closeModal() {
  if (saving.value) return
  modal.value = { open: false, mode: 'create', heroId: null }
  formError.value = ''
}

function toNumber(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function payload() {
  return {
    name: (form.value.name || '').trim(),
    epithet: (form.value.epithet || '').trim(),
    faction: form.value.faction,
    type: form.value.type,
    power: toNumber(form.value.power),
    leadership: toNumber(form.value.leadership),
    sortOrder: toNumber(form.value.sortOrder),
    description: (form.value.description || '').trim(),
    hp: toNumber(form.value.hp),
    skillName: (form.value.skillName || '').trim() || null,
    skillType: (form.value.skillType || '').trim() || null,
    skillDesc: (form.value.skillDesc || '').trim() || null
  }
}

function validateClient() {
  const p = payload()
  if (!p.name) return '将军姓名不可为空'
  if (p.name.length > 20) return '姓名不超过二十字'
  if (!p.faction) return '请选择阵营'
  if (!p.type) return '请选择类型'
  if (p.power !== null && (p.power < 0 || p.power > 100)) return '武力需在 0 - 100 之间'
  if (p.leadership !== null && (p.leadership < 0 || p.leadership > 100)) return '统率需在 0 - 100 之间'
  if (p.hp !== null && (p.hp < 1 || p.hp > 10)) return '体力上限需在 1 - 10 之间'
  if (p.description.length > 200) return '小传不超过二百字'
  if (p.skillName && p.skillName.length > 20) return '武将技名称不超过二十字'
  if (p.skillDesc && p.skillDesc.length > 120) return '武将技描述不超过一百二十字'
  return ''
}

async function saveHero() {
  const clientError = validateClient()
  if (clientError) {
    formError.value = clientError
    return
  }
  saving.value = true
  formError.value = ''
  const isEdit = modal.value.mode === 'edit'
  const url = isEdit ? `/api/admin/heroes/${modal.value.heroId}` : '/api/admin/heroes'
  const { body } = await send(url, isEdit ? 'PUT' : 'POST', payload())
  saving.value = false
  if (!body) return
  if (!body.success) {
    formError.value = body.message || '保存失败'
    return
  }
  modal.value = { open: false, mode: 'create', heroId: null }
  toast(body.message || '已保存')
  await Promise.all([loadMeta(), loadHeroes()])
}

/* 英雄榜删除 */
const confirm = ref({ open: false, hero: null, busy: false })
function askDelete(hero) {
  confirm.value = { open: true, hero, busy: false }
}
function closeConfirm() {
  if (confirm.value.busy) return
  confirm.value = { open: false, hero: null, busy: false }
}
async function doDelete() {
  const hero = confirm.value.hero
  if (!hero) return
  confirm.value.busy = true
  const { body } = await send(`/api/admin/heroes/${hero.id}`, 'DELETE')
  confirm.value.busy = false
  if (!body) return
  confirm.value = { open: false, hero: null, busy: false }
  toast(body.message || (body.success ? '已移除' : '删除失败'), body.success)
  if (body.success) await Promise.all([loadMeta(), loadHeroes()])
}

/* ==================== 军机要务 ==================== */
const tasks = ref([])
const taskLoading = ref(false)
const taskKeyword = ref('')
let taskTimer = null

async function loadTasks() {
  taskLoading.value = true
  const q = taskKeyword.value.trim() ? '?keyword=' + encodeURIComponent(taskKeyword.value.trim()) : ''
  const r = await get('/api/admin/tasks' + q)
  taskLoading.value = false
  if (r.body && r.body.success) tasks.value = r.body.data || []
}
function onTaskKeyword() {
  clearTimeout(taskTimer)
  taskTimer = setTimeout(loadTasks, 320)
}

const taskModal = ref({ open: false, mode: 'create', id: null })
const taskForm = ref({ title: '', category: '军务', done: false, sortOrder: null })
const taskError = ref('')
const taskSaving = ref(false)

function openTaskCreate() {
  taskForm.value = { title: '', category: '军务', done: false, sortOrder: null }
  taskError.value = ''
  taskModal.value = { open: true, mode: 'create', id: null }
}
function openTaskEdit(t) {
  taskForm.value = {
    title: t.title || '', category: t.category || '军务', done: !!t.done, sortOrder: t.sortOrder
  }
  taskError.value = ''
  taskModal.value = { open: true, mode: 'edit', id: t.id }
}
function closeTaskModal() {
  if (taskSaving.value) return
  taskModal.value = { open: false, mode: 'create', id: null }
}
async function saveTask() {
  if (!taskForm.value.title.trim()) {
    taskError.value = '要务内容不可为空'
    return
  }
  taskSaving.value = true
  taskError.value = ''
  const isEdit = taskModal.value.mode === 'edit'
  const url = isEdit ? `/api/admin/tasks/${taskModal.value.id}` : '/api/admin/tasks'
  const payload = {
    title: taskForm.value.title.trim(),
    category: taskForm.value.category,
    done: taskForm.value.done,
    sortOrder: toNumber(taskForm.value.sortOrder)
  }
  const { body } = await send(url, isEdit ? 'PUT' : 'POST', payload)
  taskSaving.value = false
  if (!body) return
  if (!body.success) {
    taskError.value = body.message || '保存失败'
    return
  }
  taskModal.value = { open: false, mode: 'create', id: null }
  toast(body.message || '已保存')
  await loadTasks()
  loadMeta()
}
async function toggleTask(t) {
  const { body } = await send(`/api/admin/tasks/${t.id}`, 'PUT', {
    title: t.title, category: t.category, done: !t.done, sortOrder: t.sortOrder
  })
  if (body && body.success) {
    t.done = !t.done
    toast(t.done ? '已办毕' : '已重开', true)
  } else if (body) {
    toast(body.message || '操作失败', false)
  }
}
async function deleteTask(t) {
  if (!window.confirm(`确认删除要务「${t.title}」？`)) return
  const { body } = await send(`/api/admin/tasks/${t.id}`, 'DELETE')
  if (body && body.success) {
    toast('要务已移除')
    await loadTasks()
    loadMeta()
  } else if (body) toast(body.message || '删除失败', false)
}

/* ==================== 烽火快报 ==================== */
const news = ref([])
const newsLoading = ref(false)
const newsKeyword = ref('')
let newsTimer = null

async function loadNews() {
  newsLoading.value = true
  const q = newsKeyword.value.trim() ? '?keyword=' + encodeURIComponent(newsKeyword.value.trim()) : ''
  const r = await get('/api/admin/news' + q)
  newsLoading.value = false
  if (r.body && r.body.success) news.value = r.body.data || []
}
function onNewsKeyword() {
  clearTimeout(newsTimer)
  newsTimer = setTimeout(loadNews, 320)
}

const newsModal = ref({ open: false, mode: 'create', id: null })
const newsForm = ref({ content: '', category: '军情', sortOrder: null })
const newsError = ref('')
const newsSaving = ref(false)

function openNewsCreate() {
  newsForm.value = { content: '', category: '军情', sortOrder: null }
  newsError.value = ''
  newsModal.value = { open: true, mode: 'create', id: null }
}
function openNewsEdit(n) {
  newsForm.value = { content: n.content || '', category: n.category || '军情', sortOrder: n.sortOrder }
  newsError.value = ''
  newsModal.value = { open: true, mode: 'edit', id: n.id }
}
function closeNewsModal() {
  if (newsSaving.value) return
  newsModal.value = { open: false, mode: 'create', id: null }
}
async function saveNews() {
  if (!newsForm.value.content.trim()) {
    newsError.value = '快报正文不可为空'
    return
  }
  newsSaving.value = true
  newsError.value = ''
  const isEdit = newsModal.value.mode === 'edit'
  const url = isEdit ? `/api/admin/news/${newsModal.value.id}` : '/api/admin/news'
  const payload = {
    content: newsForm.value.content.trim(),
    category: newsForm.value.category,
    sortOrder: toNumber(newsForm.value.sortOrder)
  }
  const { body } = await send(url, isEdit ? 'PUT' : 'POST', payload)
  newsSaving.value = false
  if (!body) return
  if (!body.success) {
    newsError.value = body.message || '保存失败'
    return
  }
  newsModal.value = { open: false, mode: 'create', id: null }
  toast(body.message || '已发布')
  await loadNews()
  loadMeta()
}
async function deleteNews(n) {
  if (!window.confirm(`确认删除快报「${n.content.slice(0, 20)}…」？`)) return
  const { body } = await send(`/api/admin/news/${n.id}`, 'DELETE')
  if (body && body.success) {
    toast('快报已移除')
    await loadNews()
    loadMeta()
  } else if (body) toast(body.message || '删除失败', false)
}

/* ==================== 学识题库 ==================== */
const quiz = ref([])
const quizLoading = ref(false)
const quizKeyword = ref('')
let quizTimer = null

async function loadQuiz() {
  quizLoading.value = true
  const q = quizKeyword.value.trim() ? '?keyword=' + encodeURIComponent(quizKeyword.value.trim()) : ''
  const r = await get('/api/admin/quiz' + q)
  quizLoading.value = false
  if (r.body && r.body.success) quiz.value = r.body.data || []
}
function onQuizKeyword() {
  clearTimeout(quizTimer)
  quizTimer = setTimeout(loadQuiz, 320)
}

const quizModal = ref({ open: false, mode: 'create', id: null })
const quizForm = ref(emptyQuiz())
const quizError = ref('')
const quizSaving = ref(false)

function emptyQuiz() {
  return {
    question: '', optionA: '', optionB: '', optionC: '', optionD: '',
    answer: 'A', explanation: '', reward: 100, category: '典故', sortOrder: null
  }
}
function openQuizCreate() {
  quizForm.value = emptyQuiz()
  quizError.value = ''
  quizModal.value = { open: true, mode: 'create', id: null }
}
function openQuizEdit(q) {
  quizForm.value = {
    question: q.question || '', optionA: q.optionA || '', optionB: q.optionB || '',
    optionC: q.optionC || '', optionD: q.optionD || '', answer: q.answer || 'A',
    explanation: q.explanation || '', reward: q.reward ?? 100, category: q.category || '典故',
    sortOrder: q.sortOrder
  }
  quizError.value = ''
  quizModal.value = { open: true, mode: 'edit', id: q.id }
}
function closeQuizModal() {
  if (quizSaving.value) return
  quizModal.value = { open: false, mode: 'create', id: null }
}
async function saveQuiz() {
  const f = quizForm.value
  if (!f.question.trim()) return setQuizError('题目不可为空')
  if (!f.optionA.trim() || !f.optionB.trim() || !f.optionC.trim() || !f.optionD.trim()) {
    return setQuizError('四个选项皆不可为空')
  }
  quizSaving.value = true
  quizError.value = ''
  const isEdit = quizModal.value.mode === 'edit'
  const url = isEdit ? `/api/admin/quiz/${quizModal.value.id}` : '/api/admin/quiz'
  const payload = {
    question: f.question.trim(), optionA: f.optionA.trim(), optionB: f.optionB.trim(),
    optionC: f.optionC.trim(), optionD: f.optionD.trim(), answer: f.answer,
    explanation: (f.explanation || '').trim(), reward: toNumber(f.reward),
    category: f.category, sortOrder: toNumber(f.sortOrder)
  }
  const { body } = await send(url, isEdit ? 'PUT' : 'POST', payload)
  quizSaving.value = false
  if (!body) return
  if (!body.success) {
    quizError.value = body.message || '保存失败'
    return
  }
  quizModal.value = { open: false, mode: 'create', id: null }
  toast(body.message || '已保存')
  await loadQuiz()
  loadMeta()
}
function setQuizError(msg) {
  quizError.value = msg
  return false
}
async function deleteQuiz(q) {
  if (!window.confirm(`确认删除题目「${q.question.slice(0, 20)}…」？`)) return
  const { body } = await send(`/api/admin/quiz/${q.id}`, 'DELETE')
  if (body && body.success) {
    toast('题目已移除')
    await loadQuiz()
    loadMeta()
  } else if (body) toast(body.message || '删除失败', false)
}

/* ==================== 将军账号 ==================== */
const users = ref([])
const userLoading = ref(false)

async function loadUsers() {
  userLoading.value = true
  const r = await get('/api/admin/users')
  userLoading.value = false
  if (r.body && r.body.success) users.value = r.body.data || []
}

const userModal = ref({ open: false, mode: 'create', id: null })
const userForm = ref({ username: '', password: '', faction: 'shu' })
const userError = ref('')
const userSaving = ref(false)

function openUserCreate() {
  userForm.value = { username: '', password: '', faction: 'shu' }
  userError.value = ''
  userModal.value = { open: true, mode: 'create', id: null }
}
function openUserEdit(u) {
  userForm.value = { username: u.username || '', password: '', faction: u.faction || 'shu' }
  userError.value = ''
  userModal.value = { open: true, mode: 'edit', id: u.id }
}
function closeUserModal() {
  if (userSaving.value) return
  userModal.value = { open: false, mode: 'create', id: null }
}
async function saveUser() {
  const f = userForm.value
  if (!f.username.trim()) {
    userError.value = '将军名号不可为空'
    return
  }
  const isEdit = userModal.value.mode === 'edit'
  if (!isEdit && f.password.length < 6) {
    userError.value = '虎符密令至少六位'
    return
  }
  if (isEdit && f.password && f.password.length < 6) {
    userError.value = '新密令至少六位（留空则不改）'
    return
  }
  userSaving.value = true
  userError.value = ''
  const url = isEdit ? `/api/admin/users/${userModal.value.id}` : '/api/admin/users'
  const payload = { username: f.username.trim(), faction: f.faction }
  if (f.password) payload.password = f.password
  const { body } = await send(url, isEdit ? 'PUT' : 'POST', payload)
  userSaving.value = false
  if (!body) return
  if (!body.success) {
    userError.value = body.message || '保存失败'
    return
  }
  userModal.value = { open: false, mode: 'create', id: null }
  toast(body.message || '已保存')
  await loadUsers()
  loadMeta()
}
async function deleteUser(u) {
  if (!window.confirm(`确认删除将军「${u.username}」？其招募/抽卡记录将一并清除。`)) return
  const { body } = await send(`/api/admin/users/${u.id}`, 'DELETE')
  if (body && body.success) {
    toast('将军已除名')
    await loadUsers()
    loadMeta()
  } else if (body) toast(body.message || '删除失败', false)
}

/* ==================== 加载调度 ==================== */
async function loadCurrent() {
  const m = activeModule.value
  if (m === 'heroes') loadHeroes()
  else if (m === 'tasks') loadTasks()
  else if (m === 'news') loadNews()
  else if (m === 'quiz') loadQuiz()
  else if (m === 'users') loadUsers()
}

async function reloadAll(silent = false) {
  await Promise.all([loadMeta(), loadCurrent()])
  if (!silent) toast('已刷新')
}

/* ==================== 退出 / 返回 ==================== */
function logout() {
  setAdminSession(null)
  emit('logout', '已退出后台')
}
function backHome() {
  emit('back')
}

/* ==================== 键盘 ==================== */
function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (confirm.value.open) closeConfirm()
  else if (modal.value.open) closeModal()
  else if (taskModal.value.open) closeTaskModal()
  else if (newsModal.value.open) closeNewsModal()
  else if (quizModal.value.open) closeQuizModal()
  else if (userModal.value.open) closeUserModal()
}

onMounted(() => {
  loadMeta()
  loadHeroes()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(searchTimer)
  clearTimeout(taskTimer)
  clearTimeout(newsTimer)
  clearTimeout(quizTimer)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="admin-app">
    <!-- 侧栏 -->
    <aside class="side">
      <div class="brand">
        <div class="seal">令</div>
        <div class="brand-text">
          <b>中军大帐</b>
          <span>后台管理</span>
        </div>
      </div>

      <nav class="side-nav" aria-label="后台菜单">
        <div class="nav-group">内容管理</div>
        <button
          v-for="m in MODULES"
          :key="m.key"
          class="nav-item"
          :class="{ active: activeModule === m.key }"
          type="button"
          @click="switchModule(m.key)"
        >
          <span class="nav-ico" aria-hidden="true">{{ m.icon }}</span>{{ m.label }}
        </button>
        <div class="nav-group">会话</div>
        <button class="nav-item" type="button" @click="backHome">返回前台</button>
        <button class="nav-item danger" type="button" @click="logout">退出后台</button>
      </nav>

      <div class="side-foot">
        <span class="who">{{ admin.username }}</span>
        <span class="role">{{ admin.role === 'admin' ? '管理员' : admin.role }}</span>
      </div>
    </aside>

    <!-- 主区 -->
    <div class="main">
      <header class="topbar">
        <div class="tb-title">
          <h1>{{ currentTitle }}</h1>
          <span class="tb-sub">{{ currentSub }}</span>
        </div>
        <div class="tb-right">
          <button
            class="icon-btn"
            type="button"
            :title="theme === 'dark' ? '切换为宣纸亮色' : '切换为水墨夜色'"
            @click="toggleTheme"
          >
            {{ theme === 'dark' ? '☀' : '☾' }}
          </button>
          <button class="ghost-btn" type="button" @click="backHome">前台首页</button>
        </div>
      </header>

      <p v-if="loadError && activeModule === 'heroes'" class="banner-err">{{ loadError }}</p>

      <!-- ============ 数据看板 ============ -->
      <section class="stats" aria-label="数据概览">
        <article class="stat main">
          <span class="stat-lb">榜上武将</span>
          <strong class="stat-num">{{ meta.total }}</strong>
          <span class="stat-hint">共 {{ (meta.types || []).length }} 个类型</span>
        </article>
        <article v-for="f in (meta.factions || [])" :key="f.key" class="stat">
          <span class="stat-lb">{{ f.name }}</span>
          <strong class="stat-num small" :data-f="f.key">{{ f.count }}</strong>
          <span class="stat-bar"><i :data-f="f.key" :style="{ width: (meta.total ? (f.count / meta.total) * 100 : 0) + '%' }"></i></span>
        </article>
        <article class="stat">
          <span class="stat-lb">平均武力</span>
          <strong class="stat-num small">{{ meta.avgPower }}</strong>
          <span class="stat-hint">武力最高：{{ meta.topHero || '—' }}</span>
        </article>
        <article class="stat">
          <span class="stat-lb">将军账号</span>
          <strong class="stat-num small">{{ meta.userCount }}</strong>
          <span class="stat-hint">招募 {{ meta.recruitCount }} · 抽卡 {{ meta.gachaCount }}</span>
        </article>
        <article class="stat">
          <span class="stat-lb">内容条数</span>
          <strong class="stat-num small">{{ meta.taskCount + meta.newsCount + meta.quizCount }}</strong>
          <span class="stat-hint">要务 {{ meta.taskCount }} · 快报 {{ meta.newsCount }} · 题库 {{ meta.quizCount }}</span>
        </article>
      </section>

      <!-- ============ 英雄榜 ============ -->
      <section v-if="activeModule === 'heroes'" class="panel">
        <div class="toolbar">
          <div class="search">
            <span class="s-icon" aria-hidden="true">⌕</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="搜姓名 / 称号 / 小传"
              aria-label="搜索武将"
              @input="onKeywordInput"
            />
          </div>
          <div class="chips" role="group" aria-label="按阵营筛选">
            <button
              v-for="f in factionOptions"
              :key="f.key"
              type="button"
              :class="['chip', { active: faction === f.key }]"
              @click="pickFaction(f.key)"
            >
              {{ f.name }}<em v-if="f.count != null">{{ f.count }}</em>
            </button>
          </div>
          <div class="chips" role="group" aria-label="按类型筛选">
            <button
              v-for="t in typeOptions"
              :key="t.key"
              type="button"
              :class="['chip', 'sub', { active: type === t.key }]"
              @click="pickType(t.key)"
            >
              {{ t.name }}<em v-if="t.count != null">{{ t.count }}</em>
            </button>
          </div>
          <div class="tb-actions">
            <button class="ghost-btn" type="button" @click="resetFilters">重置</button>
            <button class="ghost-btn" type="button" :disabled="loading" @click="reloadAll()">
              {{ loading ? '刷新中…' : '刷新' }}
            </button>
            <button class="add-btn" type="button" @click="openCreate">＋ 新增武将</button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="c-sort">排序</th>
                <th class="c-hero">武将</th>
                <th class="c-fac">阵营</th>
                <th class="c-type">类型</th>
                <th class="c-num">武力</th>
                <th class="c-num">统率</th>
                <th class="c-num">体力</th>
                <th class="c-skill">武将技</th>
                <th class="c-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in heroes" :key="h.id">
                <td class="c-sort"><span class="sort-no">{{ h.sortOrder }}</span></td>
                <td class="c-hero">
                  <div class="hero-cell">
                    <span class="h-seal" :data-f="h.faction">{{ factionShort(h.faction) }}</span>
                    <div class="h-name">
                      <b>{{ h.name }}</b>
                      <i>{{ h.epithet || '—' }}</i>
                    </div>
                  </div>
                </td>
                <td class="c-fac"><span class="tag" :data-f="h.faction">{{ factionName(h.faction) }}</span></td>
                <td class="c-type"><span class="tag plain">{{ h.typeName || h.type }}</span></td>
                <td class="c-num">{{ h.power ?? '—' }}</td>
                <td class="c-num">{{ h.leadership ?? '—' }}</td>
                <td class="c-num">{{ h.hp ?? '—' }}</td>
                <td class="c-skill">
                  <span v-if="h.skillName" class="skill-cell">
                    <b>{{ h.skillName }}</b>
                    <i v-if="h.skillType" class="skill-type" :data-st="h.skillType">{{ h.skillType }}</i>
                  </span>
                  <span v-else class="skill-none">—</span>
                </td>
                <td class="c-op">
                  <button class="op-btn" type="button" @click="openEdit(h)">编辑</button>
                  <button class="op-btn danger" type="button" @click="askDelete(h)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="loading && !heroes.length" class="empty">正在清点英雄榜…</p>
          <p v-else-if="!heroes.length" class="empty">
            榜上暂无符合条件的武将
            <button class="lnk" type="button" @click="openCreate">录入一位</button>
          </p>
        </div>
        <footer class="panel-foot">共 <b>{{ heroes.length }}</b> 位武将 · 保存即写入数据库，前台刷新后同步可见</footer>
      </section>

      <!-- ============ 军机要务 ============ -->
      <section v-else-if="activeModule === 'tasks'" class="panel">
        <div class="toolbar">
          <div class="search">
            <span class="s-icon" aria-hidden="true">⌕</span>
            <input v-model="taskKeyword" type="search" placeholder="搜要务内容" aria-label="搜索要务" @input="onTaskKeyword" />
          </div>
          <div class="tb-actions">
            <button class="ghost-btn" type="button" :disabled="taskLoading" @click="loadTasks">刷新</button>
            <button class="add-btn" type="button" @click="openTaskCreate">＋ 新增要务</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="c-sort">排序</th>
                <th class="c-hero">要务内容</th>
                <th class="c-type">类别</th>
                <th class="c-num">状态</th>
                <th class="c-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tasks" :key="t.id">
                <td class="c-sort"><span class="sort-no">{{ t.sortOrder }}</span></td>
                <td class="c-hero"><span class="content-text" :class="{ done: t.done }">{{ t.title }}</span></td>
                <td class="c-type"><span class="tag plain">{{ t.category || '—' }}</span></td>
                <td class="c-num">
                  <button class="done-chip" :class="{ on: t.done }" type="button" @click="toggleTask(t)">
                    {{ t.done ? '已办毕' : '未办' }}
                  </button>
                </td>
                <td class="c-op">
                  <button class="op-btn" type="button" @click="openTaskEdit(t)">编辑</button>
                  <button class="op-btn danger" type="button" @click="deleteTask(t)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="taskLoading && !tasks.length" class="empty">正在清点要务…</p>
          <p v-else-if="!tasks.length" class="empty">暂无要务，点击「新增要务」录入一条</p>
        </div>
        <footer class="panel-foot">共 <b>{{ tasks.length }}</b> 条要务</footer>
      </section>

      <!-- ============ 烽火快报 ============ -->
      <section v-else-if="activeModule === 'news'" class="panel">
        <div class="toolbar">
          <div class="search">
            <span class="s-icon" aria-hidden="true">⌕</span>
            <input v-model="newsKeyword" type="search" placeholder="搜快报正文" aria-label="搜索快报" @input="onNewsKeyword" />
          </div>
          <div class="tb-actions">
            <button class="ghost-btn" type="button" :disabled="newsLoading" @click="loadNews">刷新</button>
            <button class="add-btn" type="button" @click="openNewsCreate">＋ 发布快报</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="c-sort">排序</th>
                <th class="c-hero">快报正文</th>
                <th class="c-type">类别</th>
                <th class="c-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in news" :key="n.id">
                <td class="c-sort"><span class="sort-no">{{ n.sortOrder }}</span></td>
                <td class="c-hero"><span class="content-text">{{ n.content }}</span></td>
                <td class="c-type"><span class="tag plain">{{ n.category || '—' }}</span></td>
                <td class="c-op">
                  <button class="op-btn" type="button" @click="openNewsEdit(n)">编辑</button>
                  <button class="op-btn danger" type="button" @click="deleteNews(n)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="newsLoading && !news.length" class="empty">正在清点快报…</p>
          <p v-else-if="!news.length" class="empty">暂无快报，点击「发布快报」撰写一则</p>
        </div>
        <footer class="panel-foot">共 <b>{{ news.length }}</b> 则快报</footer>
      </section>

      <!-- ============ 学识题库 ============ -->
      <section v-else-if="activeModule === 'quiz'" class="panel">
        <div class="toolbar">
          <div class="search">
            <span class="s-icon" aria-hidden="true">⌕</span>
            <input v-model="quizKeyword" type="search" placeholder="搜题目" aria-label="搜索题目" @input="onQuizKeyword" />
          </div>
          <div class="tb-actions">
            <button class="ghost-btn" type="button" :disabled="quizLoading" @click="loadQuiz">刷新</button>
            <button class="add-btn" type="button" @click="openQuizCreate">＋ 新增题目</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="c-sort">排序</th>
                <th class="c-hero">题目</th>
                <th class="c-fac">答案</th>
                <th class="c-type">分类</th>
                <th class="c-num">奖励</th>
                <th class="c-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in quiz" :key="q.id">
                <td class="c-sort"><span class="sort-no">{{ q.sortOrder }}</span></td>
                <td class="c-hero">
                  <span class="content-text">{{ q.question }}</span>
                  <span class="quiz-answer-hint">{{ q.answer }} · {{ optionText(q, q.answer) }}</span>
                </td>
                <td class="c-fac"><span class="tag plain strong">{{ q.answer }}</span></td>
                <td class="c-type"><span class="tag plain">{{ q.category || '—' }}</span></td>
                <td class="c-num">{{ q.reward ?? '—' }}</td>
                <td class="c-op">
                  <button class="op-btn" type="button" @click="openQuizEdit(q)">编辑</button>
                  <button class="op-btn danger" type="button" @click="deleteQuiz(q)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="quizLoading && !quiz.length" class="empty">正在清点题库…</p>
          <p v-else-if="!quiz.length" class="empty">题库暂无题目，点击「新增题目」录入一道</p>
        </div>
        <footer class="panel-foot">共 <b>{{ quiz.length }}</b> 道题</footer>
      </section>

      <!-- ============ 将军账号 ============ -->
      <section v-else-if="activeModule === 'users'" class="panel">
        <div class="toolbar">
          <div class="tb-hint">管理将军账号：新增账号、修改阵营、重置密码、除名（除名将一并清除其招募与抽卡记录）。</div>
          <div class="tb-actions">
            <button class="ghost-btn" type="button" :disabled="userLoading" @click="loadUsers">刷新</button>
            <button class="add-btn" type="button" @click="openUserCreate">＋ 新增账号</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="c-sort">ID</th>
                <th class="c-hero">将军名号</th>
                <th class="c-fac">阵营</th>
                <th class="c-num">招募武将</th>
                <th class="c-type">入册时间</th>
                <th class="c-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td class="c-sort"><span class="sort-no">{{ u.id }}</span></td>
                <td class="c-hero"><span class="content-text strong">{{ u.username }}</span></td>
                <td class="c-fac"><span class="tag" :data-f="u.faction">{{ factionName(u.faction) }}</span></td>
                <td class="c-num">{{ u.recruited ?? '—' }}</td>
                <td class="c-type"><span class="content-text faint">{{ u.createTime || '—' }}</span></td>
                <td class="c-op">
                  <button class="op-btn" type="button" @click="openUserEdit(u)">编辑</button>
                  <button class="op-btn danger" type="button" @click="deleteUser(u)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="userLoading && !users.length" class="empty">正在清点账号…</p>
          <p v-else-if="!users.length" class="empty">暂无将军账号</p>
        </div>
        <footer class="panel-foot">共 <b>{{ users.length }}</b> 个将军账号</footer>
      </section>
    </div>

    <!-- 英雄榜 新增/编辑弹窗 -->
    <div v-if="modal.open" class="mask" @click.self="closeModal">
      <div class="dialog" role="dialog" aria-modal="true" :aria-label="modal.mode === 'edit' ? '编辑武将' : '新增武将'">
        <header class="dlg-head">
          <h2>{{ modal.mode === 'edit' ? '编辑武将' : '新增武将' }}</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeModal">✕</button>
        </header>
        <form class="dlg-body" @submit.prevent="saveHero">
          <div class="row">
            <label class="field">
              <span class="lb">姓名 <em>*</em></span>
              <input ref="nameInput" v-model="form.name" type="text" maxlength="20" placeholder="如：关羽" />
            </label>
            <label class="field">
              <span class="lb">称号</span>
              <input v-model="form.epithet" type="text" maxlength="20" placeholder="如：武圣" />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="lb">阵营 <em>*</em></span>
              <select v-model="form.faction">
                <option v-for="f in (meta.factions || [])" :key="f.key" :value="f.key">{{ f.name }}</option>
              </select>
            </label>
            <label class="field">
              <span class="lb">类型 <em>*</em></span>
              <select v-model="form.type">
                <option v-for="t in formTypeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
          </div>
          <div class="row three">
            <label class="field">
              <span class="lb">武力</span>
              <input v-model="form.power" type="number" min="0" max="100" placeholder="0 - 100" />
            </label>
            <label class="field">
              <span class="lb">统率</span>
              <input v-model="form.leadership" type="number" min="0" max="100" placeholder="0 - 100" />
            </label>
            <label class="field">
              <span class="lb">体力上限</span>
              <input v-model="form.hp" type="number" min="1" max="10" placeholder="3 - 5" />
            </label>
          </div>
          <label class="field">
            <span class="lb">小传 <em class="count">{{ (form.description || '').length }}/200</em></span>
            <textarea v-model="form.description" rows="3" maxlength="200" placeholder="一句话介绍此人，如：温酒斩华雄，过五关斩六将。"></textarea>
          </label>

          <div class="fieldset">
            <span class="fs-title">武将技（烽烟三国杀）</span>
            <div class="row">
              <label class="field">
                <span class="lb">技能名</span>
                <input v-model="form.skillName" type="text" maxlength="20" placeholder="如：武圣" />
              </label>
              <label class="field">
                <span class="lb">技能类型</span>
                <select v-model="form.skillType">
                  <option value="">（无）</option>
                  <option v-for="st in skillTypeOptions" :key="st" :value="st">{{ st }}</option>
                </select>
              </label>
            </div>
            <label class="field">
              <span class="lb">技能描述</span>
              <textarea v-model="form.skillDesc" rows="2" maxlength="120" placeholder="如：你可将任意一张手牌当作【击】使用"></textarea>
            </label>
          </div>

          <div class="row three">
            <label class="field">
              <span class="lb">排序</span>
              <input v-model="form.sortOrder" type="number" min="0" max="9999" placeholder="留空排末尾" />
            </label>
          </div>

          <p v-if="formError" class="err" role="alert">{{ formError }}</p>
          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="saving" @click="closeModal">取消</button>
            <button class="add-btn" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 军机要务 弹窗 -->
    <div v-if="taskModal.open" class="mask" @click.self="closeTaskModal">
      <div class="dialog narrow" role="dialog" aria-modal="true">
        <header class="dlg-head">
          <h2>{{ taskModal.mode === 'edit' ? '编辑要务' : '新增要务' }}</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeTaskModal">✕</button>
        </header>
        <form class="dlg-body" @submit.prevent="saveTask">
          <label class="field">
            <span class="lb">要务内容 <em>*</em></span>
            <textarea v-model="taskForm.title" rows="3" maxlength="255" placeholder="如：押运粮草三十车至前线大营"></textarea>
          </label>
          <div class="row">
            <label class="field">
              <span class="lb">类别</span>
              <select v-model="taskForm.category">
                <option v-for="c in ['军务', '内政', '外交']" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="field">
              <span class="lb">排序</span>
              <input v-model="taskForm.sortOrder" type="number" min="0" max="9999" placeholder="留空排末尾" />
            </label>
          </div>
          <label class="checkbox">
            <input v-model="taskForm.done" type="checkbox" />
            <span>标记为已办毕</span>
          </label>
          <p v-if="taskError" class="err" role="alert">{{ taskError }}</p>
          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="taskSaving" @click="closeTaskModal">取消</button>
            <button class="add-btn" type="submit" :disabled="taskSaving">{{ taskSaving ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 烽火快报 弹窗 -->
    <div v-if="newsModal.open" class="mask" @click.self="closeNewsModal">
      <div class="dialog narrow" role="dialog" aria-modal="true">
        <header class="dlg-head">
          <h2>{{ newsModal.mode === 'edit' ? '编辑快报' : '发布快报' }}</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeNewsModal">✕</button>
        </header>
        <form class="dlg-body" @submit.prevent="saveNews">
          <label class="field">
            <span class="lb">快报正文 <em>*</em></span>
            <textarea v-model="newsForm.content" rows="3" maxlength="255" placeholder="如：江北探马回报：曹军辎重营西移三十里。"></textarea>
          </label>
          <div class="row">
            <label class="field">
              <span class="lb">类别</span>
              <select v-model="newsForm.category">
                <option v-for="c in ['军情', '朝野', '异象']" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="field">
              <span class="lb">排序</span>
              <input v-model="newsForm.sortOrder" type="number" min="0" max="9999" placeholder="留空排末尾" />
            </label>
          </div>
          <p v-if="newsError" class="err" role="alert">{{ newsError }}</p>
          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="newsSaving" @click="closeNewsModal">取消</button>
            <button class="add-btn" type="submit" :disabled="newsSaving">{{ newsSaving ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 学识题库 弹窗 -->
    <div v-if="quizModal.open" class="mask" @click.self="closeQuizModal">
      <div class="dialog" role="dialog" aria-modal="true">
        <header class="dlg-head">
          <h2>{{ quizModal.mode === 'edit' ? '编辑题目' : '新增题目' }}</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeQuizModal">✕</button>
        </header>
        <form class="dlg-body" @submit.prevent="saveQuiz">
          <label class="field">
            <span class="lb">题目 <em>*</em></span>
            <textarea v-model="quizForm.question" rows="2" maxlength="255" placeholder="如：三顾茅庐中，刘备拜访的是哪位卧龙先生？"></textarea>
          </label>
          <div class="row">
            <label class="field">
              <span class="lb">选项 A <em>*</em></span>
              <input v-model="quizForm.optionA" type="text" maxlength="120" placeholder="选项 A" />
            </label>
            <label class="field">
              <span class="lb">选项 B <em>*</em></span>
              <input v-model="quizForm.optionB" type="text" maxlength="120" placeholder="选项 B" />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="lb">选项 C <em>*</em></span>
              <input v-model="quizForm.optionC" type="text" maxlength="120" placeholder="选项 C" />
            </label>
            <label class="field">
              <span class="lb">选项 D <em>*</em></span>
              <input v-model="quizForm.optionD" type="text" maxlength="120" placeholder="选项 D" />
            </label>
          </div>
          <div class="row three">
            <label class="field">
              <span class="lb">正确答案 <em>*</em></span>
              <select v-model="quizForm.answer">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
            <label class="field">
              <span class="lb">奖励军饷</span>
              <input v-model="quizForm.reward" type="number" min="0" placeholder="100" />
            </label>
            <label class="field">
              <span class="lb">分类</span>
              <select v-model="quizForm.category">
                <option v-for="c in ['典故', '人物', '地理', '兵制']" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
          </div>
          <label class="field">
            <span class="lb">解析（答完展示）</span>
            <textarea v-model="quizForm.explanation" rows="2" maxlength="255" placeholder="如：刘备三顾茅庐请出诸葛亮，得《隆中对》定三分之策。"></textarea>
          </label>
          <div class="row">
            <label class="field">
              <span class="lb">排序</span>
              <input v-model="quizForm.sortOrder" type="number" min="0" max="9999" placeholder="留空排末尾" />
            </label>
          </div>
          <p v-if="quizError" class="err" role="alert">{{ quizError }}</p>
          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="quizSaving" @click="closeQuizModal">取消</button>
            <button class="add-btn" type="submit" :disabled="quizSaving">{{ quizSaving ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 将军账号 弹窗 -->
    <div v-if="userModal.open" class="mask" @click.self="closeUserModal">
      <div class="dialog narrow" role="dialog" aria-modal="true">
        <header class="dlg-head">
          <h2>{{ userModal.mode === 'edit' ? '编辑账号' : '新增账号' }}</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeUserModal">✕</button>
        </header>
        <form class="dlg-body" @submit.prevent="saveUser">
          <label class="field">
            <span class="lb">将军名号 <em>*</em></span>
            <input v-model="userForm.username" type="text" maxlength="20" placeholder="登录账号，如：云长" />
          </label>
          <label class="field">
            <span class="lb">阵营 <em>*</em></span>
            <select v-model="userForm.faction">
              <option v-for="f in (meta.factions || [])" :key="f.key" :value="f.key">{{ f.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="lb">{{ userModal.mode === 'edit' ? '虎符密令（留空则不修改）' : '虎符密令（登录密码）' }} <em v-if="userModal.mode === 'create'">*</em></span>
            <input v-model="userForm.password" type="password" maxlength="50" :placeholder="userModal.mode === 'edit' ? '留空保持不变' : '至少六位'" />
          </label>
          <p v-if="userError" class="err" role="alert">{{ userError }}</p>
          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="userSaving" @click="closeUserModal">取消</button>
            <button class="add-btn" type="submit" :disabled="userSaving">{{ userSaving ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 英雄榜删除确认 -->
    <div v-if="confirm.open" class="mask" @click.self="closeConfirm">
      <div class="dialog narrow" role="dialog" aria-modal="true" aria-label="确认删除">
        <header class="dlg-head">
          <h2>确认下榜</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeConfirm">✕</button>
        </header>
        <div class="dlg-body">
          <p class="confirm-text">将从英雄榜移除「<b>{{ confirm.hero && confirm.hero.name }}</b>」，前台首页随即不再展示。</p>
          <p class="confirm-note">若该武将已被将军招募，其招募记录会一并解除；此操作不可撤销。</p>
        </div>
        <footer class="dlg-foot">
          <button class="ghost-btn" type="button" :disabled="confirm.busy" @click="closeConfirm">再想想</button>
          <button class="danger-btn" type="button" :disabled="confirm.busy" @click="doDelete">{{ confirm.busy ? '移除中…' : '确认移除' }}</button>
        </footer>
      </div>
    </div>

    <!-- 轻提示 -->
    <div v-if="toastMsg" :class="['toast', { bad: !toastOk }]" role="status">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.admin-app {
  --a-bg: #0e0a07;
  --a-panel: linear-gradient(170deg, rgba(30, 22, 16, 0.92), rgba(18, 12, 8, 0.96));
  --a-panel-solid: #17100b;
  --a-text: #f1e7d4;
  --a-dim: rgba(241, 231, 212, 0.66);
  --a-faint: rgba(241, 231, 212, 0.42);
  --a-gold: #d4af37;
  --a-gold-soft: #e8c86a;
  --a-hair: rgba(212, 175, 55, 0.3);
  --a-hair-soft: rgba(212, 175, 55, 0.14);
  --a-row: rgba(243, 233, 214, 0.03);
  --a-danger: #e05c4a;
  --a-ok: #5fb87a;
  --f-han: #b22222;
  --f-wei: #2f6fb0;
  --f-shu: #2e8b57;
  --f-wu: #1f9e8f;

  min-height: 100vh;
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  color: var(--a-text);
  font-family: var(--font-body);
  background: radial-gradient(circle at 78% -10%, #241a12 0%, #120c08 58%, #090604 100%);
}

/* ============ 侧栏 ============ */
.side {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px 16px 18px;
  border-right: 1px solid var(--a-hair-soft);
  background: linear-gradient(180deg, rgba(24, 17, 12, 0.9), rgba(12, 8, 5, 0.94));
  position: sticky;
  top: 0;
  height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.seal {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--a-gold);
  border-radius: 7px;
  color: var(--a-gold-soft);
  font-family: var(--font-cal);
  font-size: 20px;
  line-height: 1;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.brand-text b {
  font-family: var(--font-cal);
  font-size: 16px;
  letter-spacing: 3px;
}
.brand-text span {
  font-size: 11.5px;
  letter-spacing: 2px;
  color: var(--a-faint);
}
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
}
.nav-group {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--a-faint);
  margin: 10px 0 2px 10px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--a-dim);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.nav-item:hover {
  background: rgba(212, 175, 55, 0.07);
  color: var(--a-text);
}
.nav-item.active {
  color: var(--a-gold-soft);
  background: rgba(212, 175, 55, 0.1);
  border-color: var(--a-hair);
}
.nav-item.danger:hover {
  color: #ff9d8c;
  background: rgba(224, 92, 74, 0.1);
}
.nav-ico {
  font-size: 14px;
  line-height: 1;
  opacity: 0.9;
}
.side-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px dashed var(--a-hair-soft);
  font-size: 12.5px;
}
.side-foot .who {
  color: var(--a-text);
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-foot .role {
  padding: 1px 7px;
  border: 1px solid var(--a-hair);
  border-radius: 999px;
  font-size: 11px;
  color: var(--a-gold-soft);
}

/* ============ 主区 ============ */
.main {
  min-width: 0;
  padding: 20px 26px 34px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.tb-title h1 {
  font-family: var(--font-cal);
  font-size: 21px;
  letter-spacing: 2px;
}
.tb-sub {
  display: block;
  margin-top: 5px;
  font-size: 12.5px;
  color: var(--a-faint);
  letter-spacing: 0.5px;
}
.tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn,
.ghost-btn {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--a-hair);
  border-radius: 7px;
  background: rgba(243, 233, 214, 0.03);
  color: var(--a-dim);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}
.icon-btn {
  width: 34px;
  padding: 0;
  font-size: 15px;
}
.icon-btn:hover,
.ghost-btn:hover:not(:disabled) {
  color: var(--a-gold-soft);
  border-color: var(--a-gold);
  background: rgba(212, 175, 55, 0.08);
}
.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.banner-err {
  padding: 10px 14px;
  border: 1px solid rgba(224, 92, 74, 0.4);
  border-radius: 8px;
  background: rgba(224, 92, 74, 0.1);
  color: #ffab9c;
  font-size: 13px;
}

/* ============ 数据看板 ============ */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 10px;
}
.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 14px 14px;
  border: 1px solid var(--a-hair-soft);
  border-radius: 10px;
  background: var(--a-panel);
  overflow: hidden;
}
.stat.main {
  border-color: var(--a-hair);
}
.stat-lb {
  font-size: 12px;
  letter-spacing: 1.5px;
  color: var(--a-faint);
}
.stat-num {
  font-family: var(--font-cal);
  font-size: 27px;
  line-height: 1.1;
  color: var(--a-gold-soft);
}
.stat-num.small {
  font-size: 21px;
  color: var(--a-text);
}
.stat-num[data-f='han'] { color: #e2705f; }
.stat-num[data-f='wei'] { color: #6fa3d8; }
.stat-num[data-f='shu'] { color: #64bf85; }
.stat-num[data-f='wu'] { color: #55c2b4; }
.stat-hint {
  font-size: 11.5px;
  color: var(--a-faint);
}
.stat-bar {
  display: block;
  height: 3px;
  margin-top: 5px;
  border-radius: 2px;
  background: rgba(243, 233, 214, 0.08);
  overflow: hidden;
}
.stat-bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.stat-bar i[data-f='han'] { background: #b22222; }
.stat-bar i[data-f='wei'] { background: #2f6fb0; }
.stat-bar i[data-f='shu'] { background: #2e8b57; }
.stat-bar i[data-f='wu'] { background: #1f9e8f; }

/* ============ 列表面板 ============ */
.panel {
  border: 1px solid var(--a-hair-soft);
  border-radius: 12px;
  background: var(--a-panel);
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border-bottom: 1px solid var(--a-hair-soft);
}
.tb-hint {
  flex: 1;
  min-width: 200px;
  font-size: 12.5px;
  color: var(--a-faint);
  line-height: 1.7;
}
.search {
  position: relative;
  flex: 0 1 210px;
  min-width: 160px;
}
.s-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--a-faint);
  font-size: 14px;
}
.search input {
  width: 100%;
  height: 34px;
  padding: 0 10px 0 28px;
  border: 1px solid var(--a-hair);
  border-radius: 7px;
  background: rgba(243, 233, 214, 0.04);
  color: var(--a-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}
.search input::placeholder {
  color: var(--a-faint);
}
.search input:focus {
  border-color: var(--a-gold-soft);
}
.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--a-hair-soft);
  border-radius: 999px;
  background: transparent;
  color: var(--a-dim);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.16s ease;
}
.chip em {
  font-style: normal;
  font-size: 11px;
  opacity: 0.6;
}
.chip:hover {
  color: var(--a-text);
  border-color: var(--a-hair);
}
.chip.active {
  color: #241a08;
  background: linear-gradient(180deg, var(--a-gold-soft), #c9a233);
  border-color: var(--a-gold);
}
.chip.sub.active {
  color: var(--a-gold-soft);
  background: rgba(212, 175, 55, 0.14);
  border-color: var(--a-hair);
}
.tb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.add-btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--a-gold);
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.92), rgba(160, 124, 28, 0.92));
  color: #241a08;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.18s ease, box-shadow 0.18s ease;
}
.add-btn:hover:not(:disabled) {
  filter: brightness(1.06);
  box-shadow: 0 8px 20px -10px rgba(212, 175, 55, 0.9);
}
.add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.danger-btn {
  height: 34px;
  padding: 0 16px;
  border: 1px solid rgba(224, 92, 74, 0.7);
  border-radius: 7px;
  background: rgba(224, 92, 74, 0.16);
  color: #ffab9c;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.danger-btn:hover:not(:disabled) {
  background: rgba(224, 92, 74, 0.28);
}
.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-wrap {
  overflow-x: auto;
}
.grid {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13.5px;
}
.grid th,
.grid td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--a-hair-soft);
  vertical-align: middle;
}
.grid th {
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: var(--a-faint);
  background: rgba(243, 233, 214, 0.03);
  white-space: nowrap;
}
.grid tbody tr {
  transition: background 0.15s ease;
}
.grid tbody tr:hover {
  background: var(--a-row);
}
.grid tbody tr:last-child td {
  border-bottom: none;
}
.c-sort { width: 64px; }
.c-fac { width: 88px; }
.c-type { width: 84px; }
.c-num { width: 68px; text-align: center; }
.c-skill { width: 140px; }
.c-op { width: 118px; white-space: nowrap; }
.sort-no {
  display: inline-block;
  min-width: 24px;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(243, 233, 214, 0.06);
  color: var(--a-faint);
  font-size: 12px;
  text-align: center;
}
.hero-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.h-seal {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  font-size: 12.5px;
  font-family: var(--font-cal);
}
.h-seal[data-f='han'], .tag[data-f='han'] { background: var(--f-han); }
.h-seal[data-f='wei'], .tag[data-f='wei'] { background: var(--f-wei); }
.h-seal[data-f='shu'], .tag[data-f='shu'] { background: var(--f-shu); }
.h-seal[data-f='wu'], .tag[data-f='wu'] { background: var(--f-wu); }
.h-name {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.h-name b {
  font-size: 14px;
  color: var(--a-text);
}
.h-name i {
  font-style: normal;
  font-size: 11.5px;
  color: var(--a-faint);
}
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  color: #fff;
}
.tag.plain {
  background: rgba(243, 233, 214, 0.08);
  color: var(--a-dim);
  border: 1px solid var(--a-hair-soft);
}
.tag.strong {
  color: var(--a-gold-soft);
  font-weight: 700;
  border-color: var(--a-hair);
}
.content-text {
  display: block;
  font-size: 13px;
  line-height: 1.6;
  color: var(--a-dim);
  max-width: 460px;
}
.content-text.done {
  text-decoration: line-through;
  opacity: 0.55;
}
.content-text.strong {
  color: var(--a-text);
  font-weight: 600;
}
.content-text.faint {
  color: var(--a-faint);
  font-size: 12.5px;
}
.skill-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.skill-cell b {
  font-size: 12.5px;
  color: var(--a-text);
}
.skill-type {
  font-style: normal;
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--a-hair);
  color: var(--a-gold-soft);
}
.skill-none {
  color: var(--a-faint);
}
.quiz-answer-hint {
  display: block;
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--a-faint);
}
.done-chip {
  padding: 3px 10px;
  border: 1px solid var(--a-hair-soft);
  border-radius: 999px;
  background: transparent;
  color: var(--a-faint);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.done-chip:hover {
  border-color: var(--a-hair);
  color: var(--a-dim);
}
.done-chip.on {
  color: #5fb87a;
  border-color: rgba(95, 184, 122, 0.5);
  background: rgba(95, 184, 122, 0.12);
}
.op-btn {
  height: 26px;
  padding: 0 9px;
  margin-right: 6px;
  border: 1px solid var(--a-hair-soft);
  border-radius: 6px;
  background: transparent;
  color: var(--a-dim);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.16s ease;
}
.op-btn:hover {
  color: var(--a-gold-soft);
  border-color: var(--a-gold);
}
.op-btn.danger:hover {
  color: #ffab9c;
  border-color: rgba(224, 92, 74, 0.7);
}
.empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--a-faint);
  font-size: 13.5px;
}
.lnk {
  border: none;
  background: none;
  color: var(--a-gold-soft);
  font-family: inherit;
  font-size: 13.5px;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 4px;
}
.panel-foot {
  padding: 11px 16px;
  border-top: 1px solid var(--a-hair-soft);
  font-size: 12px;
  color: var(--a-faint);
}
.panel-foot b {
  color: var(--a-gold-soft);
}

/* ============ 弹窗 ============ */
.mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(6, 4, 3, 0.66);
  backdrop-filter: blur(3px);
  animation: fadeIn 0.18s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dialog {
  width: min(560px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  border: 1px solid var(--a-hair);
  border-radius: 13px;
  background: var(--a-panel-solid);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
  animation: pop 0.2s ease;
}
.dialog.narrow {
  width: min(440px, 100%);
}
@keyframes pop {
  from { opacity: 0; transform: translateY(8px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
.dlg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--a-hair-soft);
}
.dlg-head h2 {
  font-family: var(--font-cal);
  font-size: 17px;
  letter-spacing: 2px;
}
.close {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--a-faint);
  font-size: 13px;
  cursor: pointer;
}
.close:hover {
  color: var(--a-text);
  border-color: var(--a-hair-soft);
}
.dlg-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.row.three {
  grid-template-columns: 1fr 1fr 1fr;
}
.field {
  display: block;
}
.lb {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--a-dim);
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.lb em {
  color: #ff8f80;
  font-style: normal;
}
.lb em.count {
  margin-left: auto;
  color: var(--a-faint);
  font-size: 11.5px;
}
.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--a-hair);
  border-radius: 7px;
  background: rgba(243, 233, 214, 0.05);
  color: var(--a-text);
  font-family: inherit;
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.field textarea {
  resize: vertical;
  line-height: 1.6;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--a-gold-soft);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
}
.field input::placeholder,
.field textarea::placeholder {
  color: var(--a-faint);
}
.field select option {
  background: var(--a-panel-solid);
  color: var(--a-text);
}
.fieldset {
  border: 1px solid var(--a-hair-soft);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(243, 233, 214, 0.02);
}
.fs-title {
  font-size: 12.5px;
  letter-spacing: 2px;
  color: var(--a-gold-soft);
}
.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--a-dim);
  cursor: pointer;
}
.checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--a-gold);
}
.err {
  padding: 9px 12px;
  border: 1px solid rgba(224, 92, 74, 0.4);
  border-radius: 7px;
  background: rgba(224, 92, 74, 0.1);
  color: #ffab9c;
  font-size: 12.5px;
}
.dlg-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px 18px;
}
.confirm-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--a-text);
}
.confirm-text b {
  color: var(--a-gold-soft);
}
.confirm-note {
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--a-faint);
}

/* ============ 提示 ============ */
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 80;
  padding: 10px 18px;
  border: 1px solid var(--a-hair);
  border-radius: 999px;
  background: rgba(24, 17, 12, 0.96);
  color: var(--a-gold-soft);
  font-size: 13.5px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  animation: rise 0.22s ease;
  max-width: min(520px, 90vw);
  text-align: center;
}
.toast.bad {
  border-color: rgba(224, 92, 74, 0.5);
  color: #ffab9c;
}
@keyframes rise {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* ============ 响应式 ============ */
@media (max-width: 900px) {
  .admin-app {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-right: none;
    border-bottom: 1px solid var(--a-hair-soft);
    overflow-x: auto;
  }
  .brand {
    flex: 0 0 auto;
  }
  .brand-text b,
  .brand-text span {
    white-space: nowrap;
  }
  .side-nav {
    flex-direction: row;
    align-items: center;
    gap: 4px;
    flex: 1;
    overflow: visible;
  }
  .nav-group {
    display: none;
  }
  .nav-item {
    width: auto;
    padding: 8px 10px;
    white-space: nowrap;
    font-size: 13px;
  }
  .side-foot {
    flex: 0 0 auto;
    margin-left: auto;
    border-top: none;
    padding-top: 0;
  }
  .main {
    padding: 14px 14px 28px;
  }
  .tb-actions {
    margin-left: 0;
    width: 100%;
  }
  .tb-actions .add-btn {
    margin-left: auto;
  }
}
@media (max-width: 560px) {
  .row,
  .row.three {
    grid-template-columns: 1fr;
  }
}
</style>

<!-- 亮色主题：必须非 scoped，否则后代选择器会被编译器丢弃 -->
<style>
html[data-theme='light'] .admin-app {
  --a-bg: #f5ecdb;
  --a-panel: linear-gradient(170deg, rgba(255, 251, 243, 0.98), rgba(250, 242, 226, 0.99));
  --a-panel-solid: #fffaf1;
  --a-text: #2c2114;
  --a-dim: rgba(44, 33, 20, 0.72);
  --a-faint: rgba(44, 33, 20, 0.5);
  --a-gold: #9a6f1e;
  --a-gold-soft: #8a6119;
  --a-hair: rgba(154, 111, 30, 0.34);
  --a-hair-soft: rgba(154, 111, 30, 0.18);
  --a-row: rgba(120, 80, 30, 0.045);
  background: radial-gradient(circle at 78% -10%, #f8f0e1, #efe2c8 62%, #e7d7b9);
}
html[data-theme='light'] .admin-app .side {
  background: linear-gradient(180deg, rgba(255, 250, 240, 0.96), rgba(250, 242, 226, 0.98));
}
html[data-theme='light'] .admin-app .icon-btn,
html[data-theme='light'] .admin-app .ghost-btn {
  background: rgba(120, 80, 30, 0.05);
}
html[data-theme='light'] .admin-app .search input,
html[data-theme='light'] .admin-app .field input,
html[data-theme='light'] .admin-app .field select,
html[data-theme='light'] .admin-app .field textarea {
  background: rgba(120, 80, 30, 0.055);
}
html[data-theme='light'] .admin-app .field select option {
  background: #fffaf1;
  color: #2c2114;
}
html[data-theme='light'] .admin-app .chip.active,
html[data-theme='light'] .admin-app .add-btn {
  color: #fffaf0;
  background: linear-gradient(180deg, #a97a20, #8a6119);
  border-color: #8a6119;
}
html[data-theme='light'] .admin-app .chip.sub.active {
  color: #8a6119;
  background: rgba(154, 111, 30, 0.12);
}
html[data-theme='light'] .admin-app .grid th {
  background: rgba(120, 80, 30, 0.05);
}
html[data-theme='light'] .admin-app .stat-num.small {
  color: #2c2114;
}
html[data-theme='light'] .admin-app .sort-no {
  background: rgba(120, 80, 30, 0.08);
  color: rgba(44, 33, 20, 0.55);
}
html[data-theme='light'] .admin-app .tag.plain {
  background: rgba(120, 80, 30, 0.07);
  color: rgba(44, 33, 20, 0.72);
}
html[data-theme='light'] .admin-app .mask {
  background: rgba(60, 44, 24, 0.28);
}
html[data-theme='light'] .admin-app .toast {
  background: #fffaf1;
  color: #8a6119;
  box-shadow: 0 12px 30px rgba(90, 64, 20, 0.2);
}
html[data-theme='light'] .admin-app .danger-btn {
  color: #a32a1a;
}
html[data-theme='light'] .admin-app .banner-err,
html[data-theme='light'] .admin-app .err {
  color: #a32a1a;
}
html[data-theme='light'] .admin-app .skill-type {
  color: #8a6119;
}
html[data-theme='light'] .admin-app .done-chip.on {
  color: #2e7d46;
  border-color: rgba(46, 125, 70, 0.4);
  background: rgba(46, 125, 70, 0.1);
}
html[data-theme='light'] .admin-app .fieldset {
  background: rgba(120, 80, 30, 0.03);
}
</style>
