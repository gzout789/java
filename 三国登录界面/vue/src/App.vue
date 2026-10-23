<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import SanguoLogin from './components/SanguoLogin.vue'
import SanguoHome from './components/SanguoHome.vue'
import SanguoGame from './components/game/SanguoGame.vue'
import AdminLogin from './components/admin/AdminLogin.vue'
import AdminApp from './components/admin/AdminApp.vue'
import { currentUser, setSession } from './composables/useTheme'
import { adminUser, setAdminSession, ADMIN_HASH, isAdminRoute } from './composables/useAdmin'

/* ---------------- 路由（hash） ----------------
 * 前台首页导航栏的「后台管理系统」把 hash 改成 #/admin，
 * 「烽烟战场」改成 #/game，刷新页面仍停在原处，浏览器前进/后退也符合直觉。 */
const GAME_HASH = '#/game'

function isGameRoute() {
  return typeof location !== 'undefined' && location.hash.startsWith(GAME_HASH)
}

function currentRoute() {
  if (isAdminRoute()) return 'admin'
  if (isGameRoute()) return 'game'
  return 'front'
}

const route = ref(currentRoute())

function syncRoute() {
  route.value = currentRoute()
}

function navigateAdmin() {
  if (!isAdminRoute()) location.hash = ADMIN_HASH
  route.value = 'admin'
}

function navigateGame() {
  if (!isGameRoute()) location.hash = GAME_HASH
  route.value = 'game'
}

function navigateFront() {
  if (isAdminRoute() || isGameRoute()) {
    // 用 replaceState 抹掉 hash，不额外产生一条历史记录
    history.replaceState(null, '', location.pathname + location.search)
  }
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

  <!-- 烽烟三国杀（需先登录，英雄榜武将取自受保护的接口） -->
  <template v-else-if="route === 'game'">
    <SanguoGame v-if="currentUser" :user="currentUser" @exit="navigateFront" />
    <SanguoLogin v-else @login-success="handleLoginSuccess" />
  </template>

  <!-- 前台 -->
  <SanguoHome
    v-else-if="currentUser"
    :user="currentUser"
    @logout="handleLogout"
    @open-admin="navigateAdmin"
    @open-game="navigateGame"
  />
  <SanguoLogin v-else @login-success="handleLoginSuccess" />
</template>
