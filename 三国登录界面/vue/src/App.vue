<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import SanguoLogin from './components/SanguoLogin.vue'
import SanguoHome from './components/SanguoHome.vue'
import SanguoGame from './components/game/SanguoGame.vue'
import HuimengGame from './components/game/HuimengGame.vue'
import AdminLogin from './components/admin/AdminLogin.vue'
import AdminApp from './components/admin/AdminApp.vue'
import { currentUser, setSession } from './composables/useTheme'
import { adminUser, setAdminSession, ADMIN_HASH, isAdminRoute } from './composables/useAdmin'
import TeamOverlay from './components/social/TeamOverlay.vue'

/* ---------------- 路由（hash） ----------------
 * 前台首页导航栏的「后台管理系统」把 hash 改成 #/admin，
 * 「烽烟战场」改成 #/game，「会盟讨董」改成 #/huimeng，
 * 刷新页面仍停在原处，浏览器前进/后退也符合直觉。 */
const GAME_HASH = '#/game'
const HUIMENG_HASH = '#/huimeng'

/* 组队出征时把房号挂在 hash 上：#/game?team=XXXXXX，刷新也不掉队 */
function parseTeamCode() {
  if (typeof location === 'undefined') return ''
  const m = /^#\/game(?:\?team=([^&]+))?/.exec(location.hash)
  return m && m[1] ? decodeURIComponent(m[1]) : ''
}

function isGameRoute() {
  return typeof location !== 'undefined' && location.hash.startsWith(GAME_HASH)
}

function isHuimengRoute() {
  return typeof location !== 'undefined' && location.hash.startsWith(HUIMENG_HASH)
}

function currentRoute() {
  if (isAdminRoute()) return 'admin'
  if (isHuimengRoute()) return 'huimeng'
  if (isGameRoute()) return 'game'
  return 'front'
}

const route = ref(currentRoute())
const teamCode = ref(parseTeamCode())
/* 记住已自动响应过的出征房号，避免从牌局返回首页后被轮询反复拉回 */
const lastAutoEntered = ref('')

function syncRoute() {
  route.value = currentRoute()
  teamCode.value = parseTeamCode()
}

function navigateAdmin() {
  if (!isAdminRoute()) location.hash = ADMIN_HASH
  route.value = 'admin'
}

function navigateGame(code) {
  const target = GAME_HASH + (code ? '?team=' + encodeURIComponent(code) : '')
  if (location.hash !== target) location.hash = target
  teamCode.value = code || ''
  route.value = 'game'
}

function navigateHuimeng() {
  if (location.hash !== HUIMENG_HASH) location.hash = HUIMENG_HASH
  teamCode.value = ''
  route.value = 'huimeng'
}

function handleOpenGame(code) {
  const c = code || ''
  if (c && lastAutoEntered.value === c) return
  if (c) lastAutoEntered.value = c
  navigateGame(c)
}

/* 牌局中散队：把 hash 上的房号抹掉，但停留在游戏页 */
function clearTeam() {
  history.replaceState(null, '', location.pathname + location.search + GAME_HASH)
  teamCode.value = ''
}

function navigateFront() {
  if (isAdminRoute() || isGameRoute() || isHuimengRoute()) {
    // 用 replaceState 抹掉 hash，不额外产生一条历史记录
    history.replaceState(null, '', location.pathname + location.search)
  }
  teamCode.value = ''
  route.value = 'front'
}

function handleLoginSuccess(user) {
  setSession(user)
}

function handleLogout() {
  setSession(null)
}

function handleAdminLogin() {
  syncRoute()
}

function handleAdminLogout() {
  setAdminSession(null)
}

onMounted(() => {
  window.addEventListener('hashchange', syncRoute)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute)
})

watch(
  [route, currentUser, adminUser],
  ([r, user, admin]) => {
    if (r === 'admin') {
      document.title = admin ? `三国 · 后台管理（${admin.username}）` : '三国 · 后台登录'
      return
    }
    if (r === 'huimeng') {
      document.title = user ? `会盟讨董 · ${user.username} 在局中` : '三国 · 登录'
      return
    }
    if (r === 'game') {
      document.title = user ? `烽烟三国杀 · ${user.username} 在局中` : '三国 · 登录'
      return
    }
    document.title = user ? `三国 · 中军大帐（${user.username}）` : '三国 · 登录'
  },
  { immediate: true }
)
</script>

<template>
  <!-- 后台管理 -->
  <template v-if="route === 'admin'">
    <AdminApp
      v-if="adminUser"
      :admin="adminUser"
      @logout="handleAdminLogout"
      @back="navigateFront"
    />
    <AdminLogin v-else @login-success="handleAdminLogin" @back="navigateFront" />
  </template>

  <!-- 会盟讨董：第二模式，纯本地对局，不依赖英雄榜接口 -->
  <template v-else-if="route === 'huimeng'">
    <HuimengGame v-if="currentUser" :user="currentUser" @exit="navigateFront" />
    <SanguoLogin v-else @login-success="handleLoginSuccess" />
  </template>

  <!-- 烽烟三国杀（需先登录，英雄榜武将取自受保护的接口） -->
  <template v-else-if="route === 'game'">
    <template v-if="currentUser">
      <SanguoGame :user="currentUser" :team-code="teamCode" @exit="navigateFront" />
      <TeamOverlay v-if="teamCode" :code="teamCode" :user="currentUser" @leave="clearTeam" />
    </template>
    <SanguoLogin v-else @login-success="handleLoginSuccess" />
  </template>

  <!-- 前台 -->
  <SanguoHome
    v-else-if="currentUser"
    :user="currentUser"
    @logout="handleLogout"
    @open-admin="navigateAdmin"
    @open-game="handleOpenGame"
    @open-huimeng="navigateHuimeng"
  />
  <SanguoLogin v-else @login-success="handleLoginSuccess" />
</template>
