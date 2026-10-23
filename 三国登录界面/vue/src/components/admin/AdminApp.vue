<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTheme } from '../../composables/useTheme'
import { adminFetch, setAdminSession } from '../../composables/useAdmin'

const props = defineProps({
  admin: { type: Object, required: true }
})
const emit = defineEmits(['logout', 'back'])

const { theme, toggleTheme } = useTheme()

/* ==================== 数据 ==================== */
const heroes = ref([])
const meta = ref({ total: 0, factions: [], types: [], typeOptions: [], avgPower: 0, topHero: '' })
const loading = ref(false)
const loadError = ref('')

const keyword = ref('')
const faction = ref('all')
const type = ref('all')

let searchTimer = null

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

/** 表单里可选类型：后端预置四种 + 库中已有的自定义类型 */
const formTypeOptions = computed(() => meta.value.typeOptions || ['君主', '军师', '猛将', '统帅'])

function factionName(key) {
  const hit = (meta.value.factions || []).find((f) => f.key === key)
  return hit ? hit.name : key || '—'
}
/** 印章单字：汉室→汉、曹魏→魏、蜀汉→蜀、东吴→吴 */
const FACTION_SHORT = { han: '汉', wei: '魏', shu: '蜀', wu: '吴' }
function factionShort(key) {
  return FACTION_SHORT[key] || '·'
}

/* ==================== 加载 ==================== */
function toast(msg, ok = true) {
  toastMsg.value = msg
  toastOk.value = ok
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 2600)
}
const toastMsg = ref('')
const toastOk = ref(true)
let toastTimer = null

/** 401 统一处理：清掉令牌退回后台登录页 */
function handleExpired() {
  setAdminSession(null)
  emit('logout', '管理凭信已失效，请重新登录')
}

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

async function loadMeta() {
  const { status, body } = await adminFetch('/api/admin/meta')
  if (status === 401) {
    handleExpired()
    return
  }
  if (body && body.success) meta.value = body.data
}

async function reloadAll(silent = false) {
  await Promise.all([loadMeta(), loadHeroes()])
  if (!silent && !loadError.value) toast('英雄榜已刷新')
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

/* ==================== 新增 / 编辑 ==================== */
const modal = ref({ open: false, mode: 'create', heroId: null })
const form = ref(emptyForm())
const formError = ref('')
const saving = ref(false)
const nameInput = ref(null)

function emptyForm() {
  return {
    name: '',
    epithet: '',
    faction: 'shu',
    type: '猛将',
    power: 80,
    leadership: 80,
    sortOrder: null,
    description: ''
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
    name: hero.name || '',
    epithet: hero.epithet || '',
    faction: hero.faction || 'han',
    type: hero.type || '猛将',
    power: hero.power,
    leadership: hero.leadership,
    sortOrder: hero.sortOrder,
    description: hero.description || ''
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
    description: (form.value.description || '').trim()
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
  if (p.description.length > 200) return '小传不超过二百字'
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
  const { status, body } = await adminFetch(url, {
    method: isEdit ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload())
  })
  saving.value = false

  if (status === 401) {
    handleExpired()
    return
  }
  if (status === 0 || !body) {
    formError.value = '与后端失联，保存失败'
    return
  }
  if (!body.success) {
    formError.value = body.message || '保存失败'
    return
  }
  modal.value = { open: false, mode: 'create', heroId: null }
  toast(body.message || '已保存')
  await reloadAll(true)
}

/* ==================== 删除 ==================== */
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
  const { status, body } = await adminFetch(`/api/admin/heroes/${hero.id}`, { method: 'DELETE' })
  confirm.value.busy = false
  if (status === 401) {
    handleExpired()
    return
  }
  if (status === 0 || !body) {
    toast('与后端失联，删除失败', false)
    return
  }
  confirm.value = { open: false, hero: null, busy: false }
  if (body.success) {
    toast(body.message || '已移除')
    await reloadAll(true)
  } else {
    toast(body.message || '删除失败', false)
  }
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
}

onMounted(() => {
  loadMeta()
  loadHeroes()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(searchTimer)
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
        <button class="nav-item active" type="button">
          <span class="dot"></span>英雄榜
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
          <h1>英雄榜数据管理</h1>
          <span class="tb-sub">此处改动会直接反映到前台首页「英雄榜」</span>
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

      <p v-if="loadError" class="banner-err">{{ loadError }}</p>

      <!-- 数据看板 -->
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
      </section>

      <!-- 列表 -->
      <section class="panel">
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
                <th class="c-desc">小传</th>
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
                <td class="c-desc"><span class="desc">{{ h.description || '—' }}</span></td>
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

        <footer class="panel-foot">
          共 <b>{{ heroes.length }}</b> 位武将 · 保存即写入数据库，前台刷新后同步可见
        </footer>
      </section>
    </div>

    <!-- 新增 / 编辑弹窗 -->
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
              <span class="lb">排序</span>
              <input v-model="form.sortOrder" type="number" min="0" max="9999" placeholder="留空排末尾" />
            </label>
          </div>

          <label class="field">
            <span class="lb">小传 <em class="count">{{ (form.description || '').length }}/200</em></span>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="200"
              placeholder="一句话介绍此人，如：温酒斩华雄，过五关斩六将。"
            ></textarea>
          </label>

          <p v-if="formError" class="err" role="alert">{{ formError }}</p>

          <footer class="dlg-foot">
            <button class="ghost-btn" type="button" :disabled="saving" @click="closeModal">取消</button>
            <button class="add-btn" type="submit" :disabled="saving">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </footer>
        </form>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="confirm.open" class="mask" @click.self="closeConfirm">
      <div class="dialog narrow" role="dialog" aria-modal="true" aria-label="确认删除">
        <header class="dlg-head">
          <h2>确认下榜</h2>
          <button class="close" type="button" aria-label="关闭" @click="closeConfirm">✕</button>
        </header>
        <div class="dlg-body">
          <p class="confirm-text">
            将从英雄榜移除「<b>{{ confirm.hero && confirm.hero.name }}</b>」，前台首页随即不再展示。
          </p>
          <p class="confirm-note">若该武将已被将军招募，其招募记录会一并解除；此操作不可撤销。</p>
        </div>
        <footer class="dlg-foot">
          <button class="ghost-btn" type="button" :disabled="confirm.busy" @click="closeConfirm">再想想</button>
          <button class="danger-btn" type="button" :disabled="confirm.busy" @click="doDelete">
            {{ confirm.busy ? '移除中…' : '确认移除' }}
          </button>
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
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
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
  transition: width 0.5s var(--ease-out, ease);
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
.desc {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--a-dim);
  font-size: 12.5px;
  max-width: 320px;
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
  animation: pop 0.2s var(--ease-out, ease);
}
.dialog.narrow {
  width: min(420px, 100%);
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

/* ============ 亮色主题 ============
 * 注意：scoped 里的 `:global(html[x]) .local` 会被编译器丢弃后半段，
 * 因此亮色覆盖统一放到文件末尾的非 scoped 样式块中。 */

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
  .desc {
    max-width: 160px;
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
</style>
