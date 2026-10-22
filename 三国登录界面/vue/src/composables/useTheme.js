import { ref } from 'vue'

const STORAGE_KEY = 'sg_session'
const THEME_KEY = 'sg_theme'

/* ---------------- 登录态（sessionStorage，关标签页即退出） ---------------- */
function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

/* 全局共享的登录用户 */
export const currentUser = ref(readSession())

export function setSession(user) {
  currentUser.value = user
  if (user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    if (user.faction) setFaction(user.faction)
  } else {
    sessionStorage.removeItem(STORAGE_KEY)
    clearFaction()
  }
}

/* ---------------- 鉴权请求头 ----------------
 * 后端除 /api/login、/api/register 外的接口都要求 Authorization: Bearer <token>。
 * 统一从这里取，避免每个组件各写一遍。 */
export function authHeaders(extra) {
  const token = currentUser.value && currentUser.value.token
  const headers = { ...(extra || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/* ---------------- 主题（水墨夜色 / 宣纸亮色） ---------------- */
/* 只接受白名单值：localStorage 里的脏数据会让 data-theme 失效、整站配色错乱 */
const VALID_THEMES = ['dark', 'light']
function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return VALID_THEMES.includes(saved) ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

export const theme = ref(readTheme())

let themeTimer = null

function applyTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', theme.value)
  root.classList.add('theme-anim')
  clearTimeout(themeTimer)
  themeTimer = setTimeout(() => root.classList.remove('theme-anim'), 500)
}

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_KEY, theme.value)
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
  applyTheme()
}

/* ---------------- 阵营（同步到 html[data-faction]） ---------------- */
export function setFaction(faction) {
  if (faction) document.documentElement.setAttribute('data-faction', faction)
}

export function clearFaction() {
  document.documentElement.removeAttribute('data-faction')
}

/* 初始化时立刻应用主题 */
applyTheme()

/* ---------------- 水墨波纹点击反馈 ---------------- */
export function spawnInkRipple(event) {
  const el = event && event.currentTarget
  if (!el || !el.classList || !el.classList.contains('ink-ripple-host')) return
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const span = document.createElement('span')
  span.className = 'ink-ripple'
  span.style.width = `${size}px`
  span.style.height = `${size}px`
  span.style.left = `${event.clientX - rect.left - size / 2}px`
  span.style.top = `${event.clientY - rect.top - size / 2}px`
  el.appendChild(span)
  span.addEventListener('animationend', () => span.remove())
}

/* 兼容旧调用方式 */
export function useTheme() {
  return {
    theme,
    toggleTheme,
    setFaction,
    clearFaction
  }
}
