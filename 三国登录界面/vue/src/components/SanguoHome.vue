<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTheme, spawnInkRipple, authHeaders } from '../composables/useTheme'

const props = defineProps({
  user: { type: Object, required: true }
})
const emit = defineEmits(['logout', 'open-admin', 'open-game'])

const { theme, toggleTheme } = useTheme()
const ripple = spawnInkRipple

/* ---------------- 阵营 / 称谓 ---------------- */
const FACTIONS = [
  { key: 'han', label: '汉', name: '汉室' },
  { key: 'wei', label: '魏', name: '曹魏' },
  { key: 'shu', label: '蜀', name: '蜀汉' },
  { key: 'wu', label: '吴', name: '东吴' }
]

const userFaction = computed(() => props.user.faction || 'han')
const factionInfo = computed(
  () => FACTIONS.find((f) => f.key === userFaction.value) || FACTIONS[0]
)
const sealText = computed(() => factionInfo.value.label)

/* 迎将辞：按时辰问候 */
const now = new Date()
const todayText = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`
const greeting = computed(() => {
  const h = now.getHours()
  if (h >= 5 && h < 8) return '晨曦初露，宜点卯集兵'
  if (h >= 8 && h < 11) return '日上三竿，操练正当时'
  if (h >= 11 && h < 14) return '亭午时分，且用战饭'
  if (h >= 14 && h < 18) return '午后巡营，军心可用'
  if (h >= 18 && h < 20) return '暮色四合，宜鸣金收兵'
  if (h >= 20 && h < 24) return '夜巡大帐，灯火可亲'
  return '夜阑人静，将军早些安歇'
})

/* ---------------- 视图切换 ---------------- */
const VIEWS = [
  { key: 'overview', label: '总览' },
  { key: 'heroes', label: '英雄榜' },
  { key: 'recruit', label: '点将台' },
  { key: 'tasks', label: '军机要务' },
  { key: 'news', label: '烽火快报' }
]

const activeView = ref('overview')

function goView(key) {
  activeView.value = key
}

function factionName(key) {
  return (FACTIONS.find((f) => f.key === key) || {}).name || key
}

/* 武将画像路径（vue/public/heroes/武将名.png） */
function heroImg(name) {
  return '/heroes/' + encodeURIComponent(name) + '.png'
}

/* ---------------- 天下大势（各阵营人数） ---------------- */
const stats = ref(null)
const statsFailed = ref(false)
const animatedTotal = ref(0)

const factionCounts = computed(() => {
  const base = FACTIONS.map((f) => ({ ...f, count: null }))
  if (!stats.value || !stats.value.byFaction) return base
  return FACTIONS.map((f) => ({
    ...f,
    count: stats.value.byFaction[f.key] ?? 0
  }))
})

/* 数字滚动动画 */
function animateNumber(target) {
  const start = performance.now()
  function step(t) {
    const p = Math.min((t - start) / 900, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    animatedTotal.value = Math.round(target * eased)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

watch(stats, (val) => {
  if (val && typeof val.total === 'number') animateNumber(val.total)
})

/* ---------------- 会话失效统一处理 ----------------
 * token 过期或被篡改时后端返回 401。原来各请求都是静默 catch，
 * 页面会「看起来正常但一条数据都没有」，用户完全无从判断。
 * 这里统一捕获 401 并退回登录页。 */
let sessionExpired = false
function handleUnauthorized() {
  if (sessionExpired) return
  sessionExpired = true
  emit('logout')
}

async function requestJson(url) {
  const res = await fetch(url, { headers: authHeaders() })
  if (res.status === 401) {
    handleUnauthorized()
    return null
  }
  return res.json()
}

async function loadStats() {
  try {
    const data = await requestJson('/api/stats')
    if (!data) return
    if (data.success) stats.value = data.data
    else statsFailed.value = true
  } catch {
    statsFailed.value = true
  }
}

/* ---------------- 英雄榜 ---------------- */
const heroes = ref([])
const heroesMeta = ref([])
const heroTypes = ref([])
const meta = ref({ factions: [], types: [] })
const heroFaction = ref('all')
const heroType = ref('all')
const heroKeyword = ref('')

const factionChips = computed(() => {
  const list =
    meta.value.factions && meta.value.factions.length
      ? meta.value.factions
      : FACTIONS.map((f) => ({ key: f.key, name: f.name }))
  return [{ key: 'all', label: '全部' }, ...list.map((f) => ({ key: f.key, label: f.name }))]
})

const availableTypes = computed(() => {
  const list = meta.value.types || []
  if (heroFaction.value === 'all') return list
  return list.filter((t) => (t.factions || []).includes(heroFaction.value))
})

const typeChips = computed(() => [
  { key: 'all', label: '全部' },
  ...availableTypes.value.map((t) => ({ key: t.name, label: `${t.name} ${t.count}` }))
])

async function loadHeroes() {
  const params = new URLSearchParams()
  if (heroKeyword.value.trim()) params.set('keyword', heroKeyword.value.trim())
  if (heroFaction.value !== 'all') params.set('faction', heroFaction.value)
  if (heroType.value !== 'all') params.set('type', heroType.value)
  try {
    const data = await requestJson('/api/heroes?' + params.toString())
    if (data && data.success) heroes.value = data.data
  } catch {
    /* 静默失败，保留上次结果 */
  }
}

async function loadHeroesMeta() {
  try {
    const data = await requestJson('/api/heroes/meta')
    if (data && data.success) meta.value = data.data
  } catch {
    /* 忽略 */
  }
}

/* ---------------- 军机要务 ---------------- */
const tasks = ref([])
const taskCategory = ref('all')
const taskKeyword = ref('')

const taskCategories = computed(() => {
  const set = new Set(tasks.value.map((t) => t.category).filter(Boolean))
  return [{ key: 'all', label: '全部' }, ...[...set].map((c) => ({ key: c, label: c }))]
})

async function loadTasks() {
  const params = new URLSearchParams()
  if (taskKeyword.value.trim()) params.set('keyword', taskKeyword.value.trim())
  if (taskCategory.value !== 'all') params.set('category', taskCategory.value)
  try {
    const data = await requestJson('/api/tasks?' + params.toString())
    if (data.success) tasks.value = data.data
  } catch {
    /* 忽略 */
  }
}

/* ---------------- 烽火快报 ---------------- */
const news = ref([])
const newsCategory = ref('all')
const newsKeyword = ref('')

const newsCategories = computed(() => {
  const set = new Set(news.value.map((n) => n.category).filter(Boolean))
  return [{ key: 'all', label: '全部' }, ...[...set].map((c) => ({ key: c, label: c }))]
})

async function loadNews() {
  const params = new URLSearchParams()
  if (newsKeyword.value.trim()) params.set('keyword', newsKeyword.value.trim())
  if (newsCategory.value !== 'all') params.set('category', newsCategory.value)
  try {
    const data = await requestJson('/api/news?' + params.toString())
    if (data.success) news.value = data.data
  } catch {
    /* 忽略 */
  }
}

/* ---------------- 全局搜索 ---------------- */
const searchKeyword = ref('')
const searchOpen = ref(false)
const searchResult = ref({ heroes: [], tasks: [], news: [] })
const searchLoading = ref(false)
const searchTotal = computed(
  () => searchResult.value.heroes.length + searchResult.value.tasks.length + searchResult.value.news.length
)

let searchTimer = null
watch(searchKeyword, () => {
  clearTimeout(searchTimer)
  const kw = searchKeyword.value.trim()
  if (!kw) {
    searchResult.value = { heroes: [], tasks: [], news: [] }
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const data = await requestJson('/api/search?keyword=' + encodeURIComponent(kw))
      if (data.success) searchResult.value = data.data
    } catch {
      /* 忽略 */
    } finally {
      searchLoading.value = false
    }
  }, 250)
})

/* 点击搜索结果：跳转视图并带上关键词过滤 */
function jumpTo(group) {
  if (group === 'heroes') heroKeyword.value = searchKeyword.value
  else if (group === 'tasks') taskKeyword.value = searchKeyword.value
  else if (group === 'news') newsKeyword.value = searchKeyword.value
  activeView.value = group
  searchOpen.value = false
  searchKeyword.value = ''
}

function clearSearch() {
  searchKeyword.value = ''
}

function closeSearchPanel() {
  clearSearch()
  searchOpen.value = false
}

/* 点击外部关闭搜索面板 */
function onDocumentClick(e) {
  if (!e.target.closest || !e.target.closest('.searchbox')) {
    searchOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  /* 卸载后 debounce 定时器若未清理，会对已销毁实例发请求并写入 ref */
  clearTimeout(searchTimer)
  clearTimeout(heroTimer)
  clearTimeout(taskTimer)
  clearTimeout(newsTimer)
  clearTimeout(recruitMsgTimer)
})

/* 当前视图的关键词（用于「筛选中」提示条） */
const activeKeyword = computed(() => {
  if (activeView.value === 'heroes') return heroKeyword.value
  if (activeView.value === 'tasks') return taskKeyword.value
  if (activeView.value === 'news') return newsKeyword.value
  return ''
})

function clearActiveKeyword() {
  if (activeView.value === 'heroes') heroKeyword.value = ''
  else if (activeView.value === 'tasks') taskKeyword.value = ''
  else if (activeView.value === 'news') newsKeyword.value = ''
}

/* 切换阵营时重置武将类型 */
watch(heroFaction, () => {
  heroType.value = 'all'
  loadHeroes()
})
watch(heroType, () => loadHeroes())

/* 关键词防抖 */
let heroTimer = null
watch(heroKeyword, () => {
  clearTimeout(heroTimer)
  heroTimer = setTimeout(loadHeroes, 300)
})

let taskTimer = null
watch(taskCategory, () => loadTasks())
watch(taskKeyword, () => {
  clearTimeout(taskTimer)
  taskTimer = setTimeout(loadTasks, 300)
})

let newsTimer = null
watch(newsCategory, () => loadNews())
watch(newsKeyword, () => {
  clearTimeout(newsTimer)
  newsTimer = setTimeout(loadNews, 300)
})

/* ---------------- 点将台（招募） ---------------- */
const recruit = ref(null)
const recruitLoading = ref(false)
const recruitingId = ref(null)
const recruitMsg = ref('')
const recruitFaction = ref('all')

let recruitMsgTimer = null
function flashRecruitMsg(text) {
  recruitMsg.value = text
  clearTimeout(recruitMsgTimer)
  recruitMsgTimer = setTimeout(() => (recruitMsg.value = ''), 2600)
}

const gold = computed(() => (recruit.value ? recruit.value.gold : null))

const recruitChips = computed(() => [
  { key: 'all', label: '全部' },
  ...FACTIONS.map((f) => ({ key: f.key, label: f.name }))
])

const recruitAll = computed(() => (recruit.value && recruit.value.generals) || [])

const recruitCandidates = computed(() =>
  recruitAll.value.filter(
    (g) => !g.recruited && (recruitFaction.value === 'all' || g.faction === recruitFaction.value)
  )
)

const recruitedGenerals = computed(() => recruitAll.value.filter((g) => g.recruited))

async function loadRecruit() {
  recruitLoading.value = true
  try {
    const data = await requestJson('/api/recruit')
    if (data && data.success) recruit.value = data.data
  } catch {
    /* 静默失败，保留上次结果 */
  } finally {
    recruitLoading.value = false
  }
}

async function doRecruit(hero) {
  if (recruitingId.value) return
  if (gold.value !== null && gold.value < hero.cost) {
    flashRecruitMsg(`军饷不足，尚差 ${hero.cost - gold.value} 石`)
    return
  }
  recruitingId.value = hero.id
  try {
    const res = await fetch('/api/recruit', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ heroId: hero.id })
    })
    if (res.status === 401) {
      handleUnauthorized()
      return
    }
    const data = await res.json()
    flashRecruitMsg(data.message || (data.success ? '招募成功' : '招募未成'))
    if (data.success) await loadRecruit()
  } catch {
    flashRecruitMsg('与军中失联，招募未成')
  } finally {
    recruitingId.value = null
  }
}

/* ---------------- 退出 ---------------- */
function handleLogout() {
  emit('logout')
}

onMounted(() => {
  loadStats()
  loadHeroesMeta()
  loadHeroes()
  loadTasks()
  loadNews()
  loadRecruit()
})
</script>

<template>
  <div class="sanguo-home" :data-theme="userFaction">
    <!-- 水墨场景 -->
    <div class="scene" aria-hidden="true">
      <div class="moon"></div>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path
          d="M0 560 Q300 460 600 540 Q900 620 1200 500 Q1320 470 1440 520 L1440 900 L0 900 Z"
          fill="var(--mtn-far)"
        />
        <path
          d="M0 620 Q200 480 420 560 Q640 640 880 520 Q1120 410 1440 540 L1440 900 L0 900 Z"
          fill="var(--mtn1)"
        />
        <path
          d="M0 740 Q260 600 520 700 Q780 800 1040 660 Q1260 560 1440 700 L1440 900 L0 900 Z"
          fill="var(--mtn2)"
        />
      </svg>
      <div class="cloud c1"></div>
      <div class="cloud c2"></div>
      <div class="mist"></div>
    </div>

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <div class="seal">{{ sealText }}</div>
        <div class="brand-text">
          <div class="title">中军大帐</div>
          <div class="subtitle">运筹帷幄 · 决胜千里</div>
        </div>
      </div>

      <nav class="nav" aria-label="主导航">
        <button
          v-for="v in VIEWS"
          :key="v.key"
          type="button"
          :class="['nav-item', 'ink-ripple-host', { active: activeView === v.key }]"
          @click="goView(v.key); ripple($event)"
        >
          {{ v.label }}
        </button>

        <!-- 烽烟三国杀：进入牌局 -->
        <button
          class="nav-item nav-game ink-ripple-host"
          type="button"
          title="进入烽烟三国杀牌局"
          @click="emit('open-game'); ripple($event)"
        >
          <span class="nav-admin-icon" aria-hidden="true">⚔</span>烽烟战场
        </button>

        <!-- 后台管理系统入口：进入独立的管理登录页 -->
        <button
          class="nav-item nav-admin ink-ripple-host"
          type="button"
          title="进入后台管理系统"
          @click="emit('open-admin'); ripple($event)"
        >
          <span class="nav-admin-icon" aria-hidden="true">⚙</span>后台管理系统
        </button>
      </nav>

      <div class="top-right">
        <button
          class="btn-theme ink-ripple-host"
          type="button"
          :aria-label="theme === 'dark' ? '切换为宣纸亮色' : '切换为水墨夜色'"
          :title="theme === 'dark' ? '宣纸亮色' : '水墨夜色'"
          @click="toggleTheme(); ripple($event)"
        >
          <span class="theme-icon">{{ theme === 'dark' ? '☀' : '☾' }}</span>
        </button>

        <div :class="['searchbox', { open: searchOpen }]">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            placeholder="搜武将 / 要务 / 快报…"
            aria-label="搜索"
            @focus="searchOpen = true"
            @keydown.esc="closeSearchPanel"
          />
          <button
            v-if="searchKeyword"
            type="button"
            class="search-clear ink-ripple-host"
            aria-label="清空"
            @click="clearSearch(); ripple($event)"
          >
            ✕
          </button>

          <div v-if="searchOpen" class="search-panel">
            <template v-if="searchTotal > 0">
              <div v-if="searchResult.heroes.length" class="sr-group">
                <div class="sr-title">英雄榜</div>
                <button
                  v-for="h in searchResult.heroes"
                  :key="'h' + h.id"
                  type="button"
                  class="sr-item ink-ripple-host"
                  @click="jumpTo('heroes'); ripple($event)"
                >
                  <span class="sr-seal" :data-f="h.faction">{{ factionName(h.faction).slice(-1) }}</span>
                  <span class="sr-main">
                    <b>{{ h.name }}</b>
                    <i>{{ h.epithet }}</i>
                  </span>
                  <span class="sr-desc">{{ h.description }}</span>
                </button>
              </div>

              <div v-if="searchResult.tasks.length" class="sr-group">
                <div class="sr-title">军机要务</div>
                <button
                  v-for="t in searchResult.tasks"
                  :key="'t' + t.id"
                  type="button"
                  class="sr-item ink-ripple-host"
                  @click="jumpTo('tasks'); ripple($event)"
                >
                  <span class="sr-dot"></span>
                  <span class="sr-desc one">{{ t.title }}</span>
                </button>
              </div>

              <div v-if="searchResult.news.length" class="sr-group">
                <div class="sr-title">烽火快报</div>
                <button
                  v-for="n in searchResult.news"
                  :key="'n' + n.id"
                  type="button"
                  class="sr-item ink-ripple-host"
                  @click="jumpTo('news'); ripple($event)"
                >
                  <span class="sr-flame">🔥</span>
                  <span class="sr-desc one">{{ n.content }}</span>
                </button>
              </div>
            </template>
            <div v-else-if="searchLoading" class="sr-empty">探马四出，搜寻中…</div>
            <div v-else class="sr-empty">探马四出，未寻得「{{ searchKeyword }}」相关军情</div>
          </div>
        </div>

        <div class="user-badge">
          <span class="who">{{ user.username }}</span>
          <span class="fac">{{ user.factionName || factionInfo.name }}麾下</span>
        </div>

        <button class="btn-logout ink-ripple-host" type="button" @click="handleLogout(); ripple($event)">
          退出大帐
        </button>
      </div>
    </header>

    <!-- 主体 -->
    <main class="content">
      <div v-if="activeKeyword && activeView !== 'overview'" class="query-chip">
        搜索「{{ activeKeyword }}」筛选中
        <button type="button" @click="clearActiveKeyword">✕ 清除</button>
      </div>

      <!-- ========== 总览 ========== -->
      <template v-if="activeView === 'overview'">
        <section class="hero card" style="--i: 0">
          <div class="hero-date">{{ todayText }}</div>
          <h1 class="hero-title">{{ user.username }} 将军，{{ greeting }}</h1>
          <p class="hero-sub">
            今执 <span class="hl">{{ factionInfo.name }}</span> 旗号，帐下诸事，皆候钧命。
          </p>
        </section>

        <div class="grid">
          <section class="card" style="--i: 1">
            <h2 class="card-title">将军档案</h2>
            <ul class="profile">
              <li>
                <span class="k">名号</span>
                <span class="v">{{ user.username }}</span>
              </li>
              <li>
                <span class="k">阵营</span>
                <span class="v">{{ user.factionName || factionInfo.name }}</span>
              </li>
              <li>
                <span class="k">入册</span>
                <span class="v">{{ user.createTime || '—' }}</span>
              </li>
              <li>
                <span class="k">虎符</span>
                <span class="v">已验明正身</span>
              </li>
            </ul>
          </section>

          <section class="card" style="--i: 2">
            <h2 class="card-title">天下大势</h2>
            <div class="total-line">
              <span class="total-num">{{ stats ? animatedTotal : '—' }}</span>
              <span class="total-label">员将军逐鹿中原</span>
            </div>
            <ul class="faction-list">
              <li v-for="f in factionCounts" :key="f.key" :data-f="f.key">
                <span class="dot"></span>
                <span class="fname">{{ f.name }}</span>
                <span class="fcount">{{ f.count === null ? '—' : f.count + ' 员' }}</span>
              </li>
            </ul>
            <p v-if="statsFailed" class="tip">（烽火未明，暂取不到军情）</p>
          </section>

          <section class="card" style="--i: 3">
            <h2 class="card-title more" @click="goView('tasks')">
              军机要务
              <span class="more-link">悉数查看 →</span>
            </h2>
            <ul class="tasks">
              <li v-for="t in tasks.slice(0, 4)" :key="t.id" :class="{ done: t.done }">
                <span class="tick">✓</span>{{ t.title }}
              </li>
            </ul>
          </section>

          <section class="card" style="--i: 4">
            <h2 class="card-title more" @click="goView('news')">
              烽火快报
              <span class="more-link">悉数查看 →</span>
            </h2>
            <ul class="news">
              <li v-for="n in news.slice(0, 4)" :key="n.id">
                <span class="flame">🔥</span>{{ n.content }}
              </li>
            </ul>
          </section>

          <section class="card" style="--i: 5">
            <h2 class="card-title more" @click="goView('recruit')">
              点将台
              <span class="more-link">前往点将 →</span>
            </h2>
            <div class="total-line">
              <span class="total-num">{{ recruit ? recruit.recruitedCount : '—' }}</span>
              <span class="total-label">员将军已在帐下</span>
            </div>
            <p class="rc-ov-gold">
              军饷余 <b>{{ recruit ? recruit.gold : '—' }}</b> 石
              <span v-if="recruit" class="rc-ov-used">（已用 {{ recruit.spent }} / {{ recruit.initialGold }}）</span>
            </p>
            <ul class="rc-ov-roster">
              <li v-for="g in recruitedGenerals.slice(-3)" :key="g.id" :data-f="g.faction">
                <span class="rc-ov-name">{{ g.name }}</span>
                <span class="rc-ov-meta">{{ g.typeName }}</span>
              </li>
              <li v-if="!recruitedGenerals.length" class="rc-ov-empty">帐下尚虚，速去点将台招贤</li>
            </ul>
          </section>
        </div>
      </template>

      <!-- ========== 英雄榜 ========== -->
      <section v-else-if="activeView === 'heroes'" class="card board">
        <div class="board-head">
          <h2 class="card-title nomargin">英雄榜</h2>
          <div class="chips">
            <button
              v-for="c in factionChips"
              :key="c.key"
              type="button"
              :class="['chip', 'ink-ripple-host', { active: heroFaction === c.key }]"
              @click="heroFaction = c.key; ripple($event)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>

        <div class="chips" style="margin: 10px 0 14px">
          <button
            v-for="c in typeChips"
            :key="c.key"
            type="button"
            :class="['chip', 'ink-ripple-host', 'sub', { active: heroType === c.key }]"
            @click="heroType = c.key; ripple($event)"
          >
            {{ c.label }}
          </button>
        </div>

        <div class="hero-grid">
          <article v-for="(h, i) in heroes" :key="h.id" class="hero-card" :style="{ '--i': i }">
            <div class="hc-top">
              <span class="hc-seal" :data-f="h.faction">{{ factionName(h.faction).slice(-1) }}</span>
              <div class="hc-name">
                <b>{{ h.name }}</b>
                <i>{{ h.epithet }}</i>
              </div>
              <span class="hc-fac" :data-f="h.faction">{{ factionName(h.faction) }}</span>
            </div>
            <div class="hc-portrait" :data-f="h.faction">
              <img
                :src="heroImg(h.name)"
                :alt="h.name"
                loading="lazy"
                @error="$event.target.parentElement.style.display = 'none'"
              />
            </div>
            <p class="hc-desc">{{ h.description }}</p>
            <div class="hc-tags">
              <span class="hc-type" :data-f="h.faction">{{ h.typeName }}</span>
              <span v-if="h.power != null" class="hc-power">武力 {{ h.power }}</span>
              <span v-if="h.leadership != null" class="hc-power">统率 {{ h.leadership }}</span>
            </div>
          </article>
        </div>
        <p v-if="!heroes.length" class="tip">榜上暂无符合条件的将军</p>
      </section>

      <!-- ========== 点将台 ========== -->
      <section v-else-if="activeView === 'recruit'" class="card board recruit">
        <div class="board-head">
          <h2 class="card-title nomargin">点将台</h2>
          <div class="gold-box">
            <span class="gold-label">军饷</span>
            <span class="gold-num">{{ recruit ? recruit.gold : '—' }}</span>
            <span class="gold-unit">石</span>
            <span v-if="recruit" class="gold-used">已用 {{ recruit.spent }} / {{ recruit.initialGold }}</span>
          </div>
        </div>

        <div class="chips" style="margin: 0 0 8px">
          <button
            v-for="c in recruitChips"
            :key="c.key"
            type="button"
            :class="['chip', 'ink-ripple-host', { active: recruitFaction === c.key }]"
            @click="recruitFaction = c.key; ripple($event)"
          >
            {{ c.label }}
          </button>
        </div>

        <p class="rc-hint">同阵营按原价招揽；他阵营需加价五成。军饷有限，先招心腹，再图虎将。</p>

        <div class="hero-grid">
          <article v-for="(g, i) in recruitCandidates" :key="g.id" class="hero-card rc-card" :style="{ '--i': i }">
            <div class="hc-top">
              <span class="hc-seal" :data-f="g.faction">{{ factionName(g.faction).slice(-1) }}</span>
              <div class="hc-name">
                <b>{{ g.name }}</b>
                <i>{{ g.epithet }}</i>
              </div>
              <span class="hc-fac" :data-f="g.faction">{{ factionName(g.faction) }}</span>
            </div>

            <div class="hc-portrait" :data-f="g.faction">
              <img
                :src="heroImg(g.name)"
                :alt="g.name"
                loading="lazy"
                @error="$event.target.parentElement.style.display = 'none'"
              />
              <span v-if="!g.sameFaction" class="rc-foreign">他阵营 +50%</span>
            </div>

            <p class="hc-desc">{{ g.description }}</p>

            <div class="hc-tags">
              <span class="hc-type" :data-f="g.faction">{{ g.typeName }}</span>
              <span v-if="g.power != null" class="hc-power">武力 {{ g.power }}</span>
              <span v-if="g.leadership != null" class="hc-power">统率 {{ g.leadership }}</span>
            </div>

            <div class="rc-foot">
              <span class="rc-cost"><b>{{ g.cost }}</b> 石</span>
              <button
                type="button"
                class="rc-btn ink-ripple-host"
                :disabled="recruitingId === g.id || (gold !== null && gold < g.cost)"
                @click="doRecruit(g); ripple($event)"
              >
                {{
                  recruitingId === g.id
                    ? '招揽中…'
                    : gold !== null && gold < g.cost
                      ? '军饷不足'
                      : '招 募'
                }}
              </button>
            </div>
          </article>
        </div>
        <p v-if="!recruitCandidates.length" class="tip">
          {{ recruitLoading ? '点将台开张中…' : '此旗号下已无未招之将' }}
        </p>

        <template v-if="recruitedGenerals.length">
          <h3 class="rc-sub">
            帐下诸将
            <span class="rc-sub-count">{{ recruitedGenerals.length }} 员</span>
          </h3>
          <ul class="rc-roster">
            <li v-for="g in recruitedGenerals" :key="g.id" :data-f="g.faction">
              <span class="rc-roster-seal">{{ factionName(g.faction).slice(-1) }}</span>
              <span class="rc-roster-name">{{ g.name }}</span>
              <span class="rc-roster-epithet">{{ g.epithet }}</span>
              <span class="rc-roster-meta">{{ factionName(g.faction) }} · {{ g.typeName }}</span>
              <span class="rc-roster-time">{{ g.recruitedAt }}</span>
            </li>
          </ul>
        </template>
      </section>

      <!-- ========== 军机要务 ========== -->
      <section v-else-if="activeView === 'tasks'" class="card board">
        <div class="board-head">
          <h2 class="card-title nomargin">军机要务</h2>
          <div class="chips">
            <button
              v-for="c in taskCategories"
              :key="c.key"
              type="button"
              :class="['chip', 'ink-ripple-host', { active: taskCategory === c.key }]"
              @click="taskCategory = c.key; ripple($event)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
        <span class="board-count">
          {{ tasks.filter((t) => t.done).length }} / {{ tasks.length }} 已毕
        </span>
        <ul class="tasks full">
          <li v-for="(t, i) in tasks" :key="t.id" :class="{ done: t.done }" :style="{ '--i': i }">
            <span class="tick">✓</span>{{ t.title }}
            <span v-if="t.category" class="li-cat">{{ t.category }}</span>
          </li>
        </ul>
        <p v-if="!tasks.length" class="tip">暂无符合条件的要务</p>
      </section>

      <!-- ========== 烽火快报 ========== -->
      <section v-else class="card board">
        <div class="board-head">
          <h2 class="card-title nomargin">烽火快报</h2>
          <div class="chips">
            <button
              v-for="c in newsCategories"
              :key="c.key"
              type="button"
              :class="['chip', 'ink-ripple-host', { active: newsCategory === c.key }]"
              @click="newsCategory = c.key; ripple($event)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
        <span class="board-count">共 {{ news.length }} 则</span>
        <ul class="news full">
          <li v-for="(n, i) in news" :key="n.id" :style="{ '--i': i }">
            <span class="flame">🔥</span>{{ n.content }}
          </li>
        </ul>
        <p v-if="!news.length" class="tip">暂无符合条件的快报</p>
      </section>
    </main>

    <Transition name="rc-fade">
      <div v-if="recruitMsg" class="rc-toast">{{ recruitMsg }}</div>
    </Transition>

    <footer class="footer">凭此印信，出入中军 · 点「退出大帐」可返回登录</footer>
  </div>
</template>

<style scoped>
.sanguo-home {
  --paper: #f3e9d6;
  --gold: #d4af37;
  --gold-soft: #e8c86a;
  --primary: #b22222;
  --primary-deep: #7a1414;
  --accent-glow: rgba(178, 34, 34, 0.7);
  --text: var(--paper);
  --text-dim: rgba(243, 233, 214, 0.68);
  --text-mute: rgba(243, 233, 214, 0.55);
  --text-faint: rgba(243, 233, 214, 0.45);
  --text-ghost: rgba(243, 233, 214, 0.4);
  --surface: linear-gradient(160deg, rgba(26, 20, 16, 0.9), rgba(20, 13, 8, 0.95));
  --surface-panel: linear-gradient(160deg, rgba(30, 23, 18, 0.98), rgba(22, 15, 10, 0.98));
  --surface-2: rgba(20, 13, 8, 0.55);
  --surface-soft: rgba(243, 233, 214, 0.04);
  --hair: rgba(212, 175, 55, 0.4);
  --hair-soft: rgba(212, 175, 55, 0.18);
  --hair-dash: rgba(212, 175, 55, 0.18);
  --ease-out: cubic-bezier(0.2, 0.8, 0.25, 1);
  --sky-1: #2b2018;
  --sky-2: #160d0a;
  --sky-3: #0a0705;
  --moon: #f6eedd;
  --moon-glow-a: rgba(243, 233, 214, 0.12);
  --moon-glow-b: rgba(243, 233, 214, 0.26);
  --mtn-far: #5a4631;
  --mtn1: #4a3826;
  --mtn2: #2e2118;
  --fog: rgba(243, 233, 214, 0.16);
  --cloud: rgba(243, 233, 214, 0.18);

  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  font-family: var(--font-body);
  background: radial-gradient(circle at 30% 20%, var(--sky-1) 0%, var(--sky-2) 70%, var(--sky-3) 100%);
  transition: --sky-1 0.7s ease, --sky-2 0.7s ease, --sky-3 0.7s ease;
}

.sanguo-home[data-theme="wei"] {
  --primary: #2f6fb0;
  --primary-deep: #1c4a7a;
  --accent-glow: rgba(47, 111, 176, 0.7);
  --sky-1: #182536;
  --sky-2: #0d1726;
  --sky-3: #060b14;
  --moon: #e2eaf4;
  --moon-glow-a: rgba(180, 205, 235, 0.12);
  --moon-glow-b: rgba(180, 205, 235, 0.26);
  --mtn-far: #31465f;
  --mtn1: #284258;
  --mtn2: #182c44;
  --fog: rgba(200, 220, 240, 0.14);
  --cloud: rgba(205, 222, 240, 0.16);
}
.sanguo-home[data-theme="shu"] {
  --primary: #2e8b57;
  --primary-deep: #1b5e3a;
  --accent-glow: rgba(46, 139, 87, 0.7);
  --sky-1: #182a1f;
  --sky-2: #0e1812;
  --sky-3: #060d09;
  --moon: #e6f2e8;
  --moon-glow-a: rgba(180, 230, 190, 0.12);
  --moon-glow-b: rgba(180, 230, 190, 0.24);
  --mtn-far: #2f4d3a;
  --mtn1: #254331;
  --mtn2: #16331f;
  --fog: rgba(200, 235, 210, 0.14);
  --cloud: rgba(210, 235, 215, 0.16);
}
.sanguo-home[data-theme="wu"] {
  --primary: #1f9e8f;
  --primary-deep: #127065;
  --accent-glow: rgba(31, 158, 143, 0.7);
  --sky-1: #103035;
  --sky-2: #0a1e22;
  --sky-3: #04100f;
  --moon: #ddf2f1;
  --moon-glow-a: rgba(170, 225, 225, 0.12);
  --moon-glow-b: rgba(170, 225, 225, 0.26);
  --mtn-far: #27555a;
  --mtn1: #1f454a;
  --mtn2: #123a3e;
  --fog: rgba(195, 232, 232, 0.14);
  --cloud: rgba(200, 232, 232, 0.16);
}

/* ---------- 场景 ---------- */
.scene {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.scene svg {
  width: 100%;
  height: 100%;
  display: block;
}
.moon {
  position: absolute;
  top: 7%;
  right: 10%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle at 42% 40%, var(--moon) 0%, transparent 70%);
  box-shadow: 0 0 60px 12px var(--moon-glow-a);
  animation: moonGlow 8s ease-in-out infinite;
}
@keyframes moonGlow {
  0%,
  100% {
    box-shadow: 0 0 50px 8px var(--moon-glow-a);
  }
  50% {
    box-shadow: 0 0 90px 20px var(--moon-glow-b);
  }
}
.cloud {
  position: absolute;
  background: radial-gradient(ellipse at center, var(--cloud), transparent 70%);
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.5;
  animation: drift 30s linear infinite;
}
.cloud.c1 {
  width: 380px;
  height: 160px;
  top: 14%;
  left: -20%;
}
.cloud.c2 {
  width: 300px;
  height: 130px;
  top: 48%;
  left: -35%;
  animation-duration: 44s;
}
@keyframes drift {
  0% {
    transform: translate(0);
  }
  100% {
    transform: translate(160vw);
  }
}
.mist {
  position: absolute;
  left: -20%;
  bottom: 5%;
  width: 140%;
  height: 150px;
  background: radial-gradient(ellipse at center, var(--fog), transparent 70%);
  filter: blur(16px);
  animation: mistDrift 30s ease-in-out infinite alternate;
}
@keyframes mistDrift {
  0% {
    transform: translate(-4%);
  }
  100% {
    transform: translate(4%);
  }
}

/* ---------- 顶栏 ---------- */
.topbar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 20px 30px 14px;
  animation: fadeDown 0.7s ease both;
}
@keyframes fadeDown {
  0% {
    opacity: 0;
    transform: translateY(-14px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
}
.seal {
  width: 52px;
  height: 52px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-family: var(--font-art);
  font-size: 26px;
  line-height: 1;
  transform: rotate(-6deg);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.title {
  font-family: var(--font-cal);
  font-size: 26px;
  letter-spacing: 8px;
  padding-left: 8px;
  color: var(--gold-soft);
  text-shadow: 0 2px 10px rgba(212, 175, 55, 0.35);
}
.subtitle {
  margin-top: 4px;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--text-mute);
}
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--hair);
  border-radius: 10px;
  background: var(--surface-2);
  flex: 0 1 auto;
}
.nav-item {
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  font-family: var(--font-cal);
  font-size: 15px;
  letter-spacing: 3px;
  padding: 8px 16px 8px 19px;
  border-radius: 7px;
  transition: color 0.2s, background 0.25s, border-color 0.2s, box-shadow 0.25s;
  white-space: nowrap;
}
.nav-item:hover {
  color: var(--gold-soft);
}
.nav-item.active {
  color: #fff;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
  border-color: var(--hair);
  box-shadow: 0 6px 16px -6px var(--accent-glow), inset 0 0 0 1px var(--hair-soft);
}

/* 烽烟战场入口：赤红描边，与后台管理的金色区分开 */
.nav-item.nav-game {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: 4px;
  color: #e8a48c;
  border-color: rgba(178, 34, 34, 0.55);
  background: linear-gradient(180deg, rgba(178, 34, 34, 0.18), rgba(178, 34, 34, 0.05));
  font-size: 14px;
  letter-spacing: 2px;
  padding: 8px 15px 8px 14px;
}
.nav-item.nav-game:hover {
  color: #ffe4d8;
  border-color: var(--primary);
  box-shadow: 0 6px 18px -8px var(--accent-glow);
}
.nav-item.nav-game::before {
  content: '';
  width: 1px;
  height: 18px;
  margin-right: 7px;
  background: var(--hair);
}

/* 后台管理系统入口：金色描边，与常规导航区分开 */
.nav-item.nav-admin {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: 4px;
  color: var(--gold-soft);
  border-color: var(--hair);
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.14), rgba(212, 175, 55, 0.04));
  font-size: 14px;
  letter-spacing: 2px;
  padding: 8px 15px 8px 14px;
}
.nav-item.nav-admin:hover {
  color: #fff6dc;
  border-color: var(--gold);
  box-shadow: 0 6px 18px -8px rgba(212, 175, 55, 0.85);
}
.nav-item.nav-admin::before {
  content: '';
  width: 1px;
  height: 18px;
  margin-right: 7px;
  background: var(--hair);
}
.nav-admin-icon {
  font-size: 13px;
  line-height: 1;
  opacity: 0.9;
}
.top-right {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}
.btn-theme {
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hair);
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--gold-soft);
  font-size: 18px;
  line-height: 1;
  transition: color 0.2s, border-color 0.2s, transform 0.3s, box-shadow 0.25s;
}
.btn-theme:hover {
  color: #fff;
  border-color: var(--gold);
  transform: rotate(-12deg);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
}

/* ---------- 搜索 ---------- */
.searchbox {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid var(--hair);
  border-radius: 8px;
  background: var(--surface-2);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.searchbox:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
}
.search-icon {
  padding: 0 4px 0 12px;
  font-size: 18px;
  line-height: 1;
  color: rgba(212, 175, 55, 0.8);
}
.search-input {
  width: 190px;
  padding: 10px 6px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  letter-spacing: 1px;
}
.search-input::placeholder {
  color: var(--text-ghost);
}
.search-clear {
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-mute);
  font-size: 12px;
  padding: 0 12px 0 6px;
}
.search-clear:hover {
  color: var(--gold-soft);
}
.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  max-height: 60vh;
  overflow: auto;
  background: var(--surface-panel);
  border: 1px solid var(--hair);
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  padding: 8px;
  animation: fadeDown 0.25s ease both;
}
.sr-group + .sr-group {
  margin-top: 6px;
  border-top: 1px dashed var(--hair-soft);
  padding-top: 6px;
}
.sr-title {
  font-family: var(--font-cal);
  font-size: 12px;
  letter-spacing: 4px;
  color: var(--gold);
  padding: 6px 10px 4px;
}
.sr-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  cursor: pointer;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  font-family: var(--font-body);
  text-align: left;
  padding: 8px 10px;
  transition: background 0.15s;
}
.sr-item:hover {
  background: rgba(212, 175, 55, 0.12);
}
.sr-seal {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--gold);
  border-radius: 5px;
  color: var(--gold);
  font-family: var(--font-art);
  font-size: 15px;
  transform: rotate(-5deg);
}
.sr-seal[data-f="wei"] {
  border-color: #5b9bd5;
  color: #5b9bd5;
}
.sr-seal[data-f="shu"] {
  border-color: #4caf7d;
  color: #4caf7d;
}
.sr-seal[data-f="wu"] {
  border-color: #3fbdb0;
  color: #3fbdb0;
}
.sr-seal[data-f="han"] {
  border-color: #d95f5f;
  color: #d95f5f;
}
.sr-main {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
}
.sr-main b {
  font-size: 14px;
  letter-spacing: 2px;
  color: var(--gold-soft);
}
.sr-main i {
  font-style: normal;
  font-size: 11px;
  color: var(--text-mute);
}
.sr-desc {
  flex: 1;
  font-size: 12px;
  color: var(--text-mute);
  text-align: right;
}
.sr-desc.one {
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gold);
}
.sr-flame {
  flex: 0 0 auto;
  font-size: 12px;
}
.sr-empty {
  padding: 18px 12px;
  text-align: center;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

/* ---------- 用户区 ---------- */
.user-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  padding: 7px 14px;
  border: 1px solid var(--hair);
  border-radius: 8px;
  background: var(--surface-2);
}
.user-badge .who {
  font-family: var(--font-cal);
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--gold-soft);
}
.user-badge .fac {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-mute);
}
.btn-logout {
  cursor: pointer;
  border: 1px solid var(--hair);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
  color: #fff;
  border-radius: 6px;
  font-family: var(--font-cal);
  font-size: 15px;
  letter-spacing: 4px;
  padding: 10px 18px 10px 22px;
  box-shadow: 0 8px 22px -8px var(--accent-glow), inset 0 0 0 1px var(--hair-soft);
  transition: filter 0.2s, transform 0.15s;
}
.btn-logout:hover {
  filter: brightness(1.1);
}
.btn-logout:active {
  transform: translateY(1px);
}

/* ---------- 内容容器 ---------- */
.content {
  position: relative;
  z-index: 2;
  width: min(1060px, 92vw);
  margin: 10px auto 0;
  flex: 1;
  animation: rise 0.8s var(--ease-out) 0.1s both;
}
@keyframes rise {
  0% {
    opacity: 0;
    transform: translateY(24px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.card {
  animation: cardIn 0.5s var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
.hero-card {
  animation: cardIn 0.5s var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 55ms);
}
.tasks.full li,
.news.full li {
  animation: cardIn 0.45s var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 45ms);
}
@keyframes cardIn {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

.query-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  padding: 6px 8px 6px 14px;
  border: 1px solid var(--hair);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--gold-soft);
}
.query-chip button {
  cursor: pointer;
  border: none;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.18);
  color: var(--gold-soft);
  font-size: 11px;
  letter-spacing: 1px;
  padding: 3px 10px;
}
.query-chip button:hover {
  background: rgba(212, 175, 55, 0.32);
}

.card {
  background: var(--surface);
  border: 1px solid var(--hair);
  border-radius: 10px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5), inset 0 0 0 1px var(--hair-soft);
  padding: 24px 26px;
  position: relative;
}
.card::before {
  content: "";
  position: absolute;
  inset: 7px;
  border: 1px solid var(--hair-soft);
  border-radius: 6px;
  pointer-events: none;
}
.card-title {
  margin: 0 0 16px;
  font-family: var(--font-cal);
  font-size: 18px;
  letter-spacing: 6px;
  color: var(--gold);
  border-bottom: 1px solid var(--hair-soft);
  padding-bottom: 10px;
}
.card-title.more {
  cursor: pointer;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.card-title.more:hover .more-link {
  color: var(--gold-soft);
}
.more-link {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--text-ghost);
  font-family: var(--font-body);
  transition: color 0.2s;
}
.card-title.nomargin {
  margin: 0;
  border-bottom: none;
  padding-bottom: 0;
}

/* ---------- 总览 ---------- */
.hero {
  margin-bottom: 18px;
  text-align: center;
  padding: 34px 26px 30px;
}
.hero-date {
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--text-mute);
  margin-bottom: 12px;
}
.hero-title {
  margin: 0;
  font-family: var(--font-cal);
  font-size: clamp(22px, 3.4vw, 34px);
  letter-spacing: 4px;
  color: var(--text);
  text-shadow: 0 2px 14px rgba(212, 175, 55, 0.3);
}
.hero-sub {
  margin: 14px 0 0;
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--text-dim);
}
.hero-sub .hl {
  color: var(--gold-soft);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  margin-bottom: 26px;
}

.profile {
  list-style: none;
  margin: 0;
  padding: 0;
}
.profile li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 9px 2px;
  border-bottom: 1px dashed var(--hair-soft);
}
.profile li:last-child {
  border-bottom: none;
}
.profile .k {
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--text-mute);
}
.profile .v {
  font-family: var(--font-cal);
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--gold-soft);
}

.total-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}
.total-num {
  font-family: var(--font-cal);
  font-size: 44px;
  line-height: 1;
  color: var(--gold-soft);
  text-shadow: 0 0 18px rgba(212, 175, 55, 0.4);
  font-variant-numeric: tabular-nums;
}
.total-label {
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--text-mute);
}

.faction-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.faction-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--hair-soft);
}
.faction-list li:last-child {
  border-bottom: none;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px -1px currentColor;
}
.faction-list li[data-f="han"] .dot {
  background: #b22222;
  color: #b22222;
}
.faction-list li[data-f="wei"] .dot {
  background: #2f6fb0;
  color: #2f6fb0;
}
.faction-list li[data-f="shu"] .dot {
  background: #2e8b57;
  color: #2e8b57;
}
.faction-list li[data-f="wu"] .dot {
  background: #1f9e8f;
  color: #1f9e8f;
}
.fname {
  flex: 1;
  font-size: 14px;
  letter-spacing: 3px;
}
.fcount {
  font-family: var(--font-cal);
  font-size: 15px;
  color: var(--gold-soft);
  letter-spacing: 1px;
}
.tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-faint);
}

/* ---------- 要务 ---------- */
.tasks {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tasks li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  font-size: 14px;
  letter-spacing: 2px;
  border-bottom: 1px dashed var(--hair-soft);
}
.tasks li:last-child {
  border-bottom: none;
}
.tasks .tick {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(212, 175, 55, 0.5);
  border-radius: 4px;
  font-size: 12px;
  color: transparent;
}
.tasks li.done {
  color: var(--text-faint);
}
.tasks li.done .tick {
  color: var(--gold);
  border-color: var(--gold);
}
.tasks.full li {
  padding: 12px 2px;
  font-size: 15px;
}
.li-cat {
  margin-left: auto;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-faint);
  border: 1px solid var(--hair-soft);
  border-radius: 999px;
  padding: 1px 9px;
}

/* ---------- 快报 ---------- */
.news {
  list-style: none;
  margin: 0;
  padding: 0;
}
.news li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 2px;
  font-size: 14px;
  letter-spacing: 1.5px;
  line-height: 1.6;
  border-bottom: 1px dashed var(--hair-soft);
}
.news li:last-child {
  border-bottom: none;
}
.flame {
  flex: 0 0 auto;
  font-size: 13px;
}
.news.full li {
  padding: 12px 2px;
  font-size: 15px;
}

/* ---------- 榜 / 列表页 ---------- */
.board {
  margin-bottom: 26px;
}
.board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--hair-soft);
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.board-count {
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--text-mute);
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  cursor: pointer;
  border: 1px solid var(--hair);
  border-radius: 999px;
  background: transparent;
  color: var(--text-dim);
  font-family: var(--font-cal);
  font-size: 13px;
  letter-spacing: 2px;
  padding: 5px 14px;
  transition: all 0.2s;
}
.chip:hover {
  color: var(--gold-soft);
  border-color: var(--gold);
}
.chip.active {
  color: #fff;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
  border-color: var(--hair);
  box-shadow: 0 4px 12px -4px var(--accent-glow);
}
.chip.sub {
  font-size: 12px;
  padding: 4px 12px;
  opacity: 0.92;
}

/* ---------- 武将卡 ---------- */
.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.hero-card {
  border: 1px solid var(--hair);
  border-radius: 9px;
  background: var(--surface-soft);
  padding: 14px 16px;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.hero-card:hover {
  transform: translateY(-3px);
  border-color: var(--gold);
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--hair-soft);
}
.hc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hc-seal {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--gold);
  border-radius: 6px;
  color: var(--gold);
  font-family: var(--font-art);
  font-size: 20px;
  transform: rotate(-5deg);
}
.hc-seal[data-f="wei"] {
  border-color: #5b9bd5;
  color: #5b9bd5;
}
.hc-seal[data-f="shu"] {
  border-color: #4caf7d;
  color: #4caf7d;
}
.hc-seal[data-f="wu"] {
  border-color: #3fbdb0;
  color: #3fbdb0;
}
.hc-seal[data-f="han"] {
  border-color: #d95f5f;
  color: #d95f5f;
}
.hc-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 武将画像 */
.hc-portrait {
  margin-top: 10px;
  border: 1px solid var(--hair);
  border-radius: 7px;
  overflow: hidden;
  background: #efe8d8;
  aspect-ratio: 3 / 2;
}
.hc-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}
.hero-card:hover .hc-portrait img {
  transform: scale(1.05);
}
.hc-portrait[data-f="wei"] {
  border-color: #5b9bd5;
}
.hc-portrait[data-f="shu"] {
  border-color: #4caf7d;
}
.hc-portrait[data-f="wu"] {
  border-color: #3fbdb0;
}
.hc-portrait[data-f="han"] {
  border-color: #d95f5f;
}
.hc-name b {
  font-family: var(--font-cal);
  font-size: 18px;
  letter-spacing: 3px;
  color: var(--gold-soft);
}
.hc-name i {
  font-style: normal;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-mute);
}
.hc-fac {
  flex: 0 0 auto;
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid var(--hair);
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--text-mute);
}
.hc-fac[data-f="wei"] {
  border-color: rgba(91, 155, 213, 0.5);
  color: #8fb8de;
}
.hc-fac[data-f="shu"] {
  border-color: rgba(76, 175, 125, 0.5);
  color: #8fd0ab;
}
.hc-fac[data-f="wu"] {
  border-color: rgba(63, 189, 176, 0.5);
  color: #86d8cf;
}
.hc-fac[data-f="han"] {
  border-color: rgba(217, 95, 95, 0.5);
  color: #e69a9a;
}
.hc-desc {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  letter-spacing: 1px;
  color: var(--text-dim);
}
.hc-tags {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.hc-type {
  font-size: 11px;
  letter-spacing: 2px;
  border: 1px solid var(--hair);
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--text-mute);
}
.hc-power {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.footer {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 18px 0 22px;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--text-faint);
}

/* ---------- 响应式 ---------- */
@media (max-width: 960px) {
  .topbar {
    flex-wrap: wrap;
  }
  .nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  .top-right {
    margin-left: auto;
  }
}
@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .topbar {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .nav {
    order: 0;
    width: 100%;
    overflow-x: auto;
    justify-content: flex-start;
  }
  .top-right {
    margin-left: 0;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .searchbox {
    flex: 1;
  }
  .search-input {
    width: 100%;
  }
  .search-panel {
    width: min(340px, 86vw);
  }
  .user-badge {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud,
  .moon,
  .mist,
  .content,
  .topbar,
  .card,
  .hero-card,
  .tasks.full li,
  .news.full li {
    animation: none;
  }
}

/* ---------- 点将台 ---------- */
.gold-box {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  border: 1px solid var(--hair);
  border-radius: 999px;
  padding: 5px 14px;
  background: rgba(212, 175, 55, 0.06);
}
.gold-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-mute);
}
.gold-num {
  font-family: var(--font-cal);
  font-size: 20px;
  letter-spacing: 1px;
  color: var(--gold-soft);
}
.gold-unit {
  font-size: 11px;
  color: var(--text-mute);
}
.gold-used {
  margin-left: 8px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.rc-hint {
  margin: 0 0 14px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.rc-card {
  position: relative;
  display: flex;
  flex-direction: column;
}
.rc-card .hc-portrait {
  position: relative;
}
.rc-foreign {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10.5px;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #f0d9a8;
  background: rgba(140, 40, 30, 0.85);
  border: 1px solid rgba(212, 175, 55, 0.5);
}
.rc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--hair-soft);
}
.rc-cost {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-mute);
}
.rc-cost b {
  font-family: var(--font-cal);
  font-size: 18px;
  letter-spacing: 1px;
  color: var(--gold-soft);
}
.rc-btn {
  cursor: pointer;
  border: 1px solid var(--gold);
  border-radius: 6px;
  background: transparent;
  color: var(--gold);
  font-family: var(--font-cal);
  font-size: 14px;
  letter-spacing: 3px;
  padding: 6px 16px;
  transition: background 0.2s, box-shadow 0.2s, color 0.2s, border-color 0.2s;
}
.rc-btn:hover:not(:disabled) {
  background: rgba(212, 175, 55, 0.14);
  box-shadow: 0 0 16px -4px var(--accent-glow);
}
.rc-btn:disabled {
  cursor: not-allowed;
  border-color: var(--hair-soft);
  color: var(--text-ghost);
}

.rc-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 26px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hair-soft);
  font-family: var(--font-cal);
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 4px;
  color: var(--gold-soft);
}
.rc-sub-count {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.rc-roster {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.rc-roster li {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--hair-soft);
  border-radius: 8px;
  padding: 9px 12px;
  background: var(--surface-soft);
  font-size: 13px;
  letter-spacing: 1px;
}
.rc-roster-seal {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gold);
  border-radius: 4px;
  font-size: 12px;
  color: var(--gold);
}
.rc-roster li[data-f="wei"] .rc-roster-seal {
  border-color: #5b9bd5;
  color: #5b9bd5;
}
.rc-roster li[data-f="shu"] .rc-roster-seal {
  border-color: #4caf7d;
  color: #4caf7d;
}
.rc-roster li[data-f="wu"] .rc-roster-seal {
  border-color: #3fbdb0;
  color: #3fbdb0;
}
.rc-roster li[data-f="han"] .rc-roster-seal {
  border-color: #d95f5f;
  color: #d95f5f;
}
.rc-roster-name {
  font-family: var(--font-cal);
  letter-spacing: 2px;
  color: var(--gold-soft);
}
.rc-roster-epithet {
  font-size: 11px;
  color: var(--text-mute);
}
.rc-roster-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-faint);
}
.rc-roster-time {
  font-size: 11px;
  color: var(--text-ghost);
}

/* 总览里的点将台小卡 */
.rc-ov-gold {
  margin: 8px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-mute);
}
.rc-ov-gold b {
  font-family: var(--font-cal);
  font-size: 15px;
  color: var(--gold-soft);
}
.rc-ov-used {
  font-size: 11px;
  color: var(--text-ghost);
}
.rc-ov-roster {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}
.rc-ov-roster li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--hair-soft);
  font-size: 13px;
}
.rc-ov-roster li:last-child {
  border-bottom: none;
}
.rc-ov-name {
  font-family: var(--font-cal);
  letter-spacing: 2px;
  color: var(--text);
}
.rc-ov-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-faint);
}
.rc-ov-roster li.rc-ov-empty {
  font-size: 12.5px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

/* 招募提示 */
.rc-toast {
  position: fixed;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  z-index: 50;
  padding: 10px 22px;
  border-radius: 999px;
  background: rgba(20, 13, 8, 0.94);
  border: 1px solid var(--hair);
  color: var(--gold-soft);
  font-size: 13.5px;
  letter-spacing: 2px;
  box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}
.rc-fade-enter-active,
.rc-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.rc-fade-enter-from,
.rc-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
