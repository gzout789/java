<script setup>
import { ref, watch } from 'vue'
import SanguoLogin from './components/SanguoLogin.vue'
import SanguoHome from './components/SanguoHome.vue'
import { currentUser, setSession } from './composables/useTheme'

function handleLoginSuccess(user) {
  setSession(user)
}

function handleLogout() {
  setSession(null)
}

watch(
  currentUser,
  (user) => {
    document.title = user ? `三国 · 中军大帐（${user.username}）` : '三国 · 登录'
  },
  { immediate: true }
)
</script>

<template>
  <SanguoHome v-if="currentUser" :user="currentUser" @logout="handleLogout" />
  <SanguoLogin v-else @login-success="handleLoginSuccess" />
</template>
