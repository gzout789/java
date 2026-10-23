import { ref } from 'vue'

/* ============================================================
 * 后台管理会话（与前台将军登录完全独立）
 * - 令牌存 sessionStorage，关掉标签页即失效
 * - 后端 /api/admin/** 要求令牌带 role=admin，前台令牌进不来
 * ============================================================ */

const ADMIN_KEY = 'sg_admin_session'

function readAdmin() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY) || 'null')
  } catch {
    return null
  }
}

export const adminUser = ref(readAdmin())

export function setAdminSession(admin) {
  adminUser.value = admin
  try {
    if (admin) sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    else sessionStorage.removeItem(ADMIN_KEY)
  } catch {
    /* 隐私模式下可能写入失败，内存态仍可用 */
  }
}

export function adminHeaders(extra) {
  const headers = { ...(extra || {}) }
  const token = adminUser.value && adminUser.value.token
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * 统一管理接口请求：始终返回 { status, body }，不抛异常给调用方。
 * status 为 0 表示网络不通（后端没起 / 断网）。
 */
export async function adminFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: adminHeaders(options.headers)
    })
    let body = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { status: res.status, body }
  } catch {
    return { status: 0, body: null }
  }
}

/* ---------------- 后台路由（hash，刷新不丢页面） ---------------- */
export const ADMIN_HASH = '#/admin'

export function isAdminRoute() {
  return typeof location !== 'undefined' && location.hash.startsWith(ADMIN_HASH)
}

export function goAdmin() {
  location.hash = ADMIN_HASH
}

export function goHome() {
  if (location.hash.startsWith(ADMIN_HASH)) {
    location.hash = '#/'
  }
}
