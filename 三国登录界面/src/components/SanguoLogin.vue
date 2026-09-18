<script setup>
import { ref, computed, onMounted } from 'vue'

// —— 登录 / 注册 模式 ——
const mode = ref('login') // login | register

// —— 阵营主题 ——
const theme = ref('han') // han | wei | shu | wu
const factions = [
  { key: 'han', label: '汉', name: '汉室' },
  { key: 'wei', label: '魏', name: '曹魏' },
  { key: 'shu', label: '蜀', name: '蜀汉' },
  { key: 'wu', label: '吴', name: '东吴' }
]
function pickFaction(key) {
  theme.value = key
  const f = factions.find((x) => x.key === key)
  showToast('已择 ' + f.name + ' 之旗')
}

// —— 表单 ——
const username = ref('')
const password = ref('')
const confirmPwd = ref('')
const remember = ref(false)
const showPwd = ref(false)
const loading = ref(false)

const eyeIcon = computed(() =>
  showPwd.value
    ? '<path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 3M6.1 6.1A13 13 0 0 0 2 12s3.5 7 10 7a9.4 9.4 0 0 0 3.9-.8"/>'
    : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
)

onMounted(() => {
  const saved = localStorage.getItem('sg_user')
  if (saved) {
    username.value = saved
    remember.value = true
  }
})

// —— Toast ——
const toastMsg = ref('')
let toastTimer = null
function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2200)
}

// —— 切换模式 ——
function switchMode(target) {
  mode.value = target
  confirmPwd.value = ''
}

// —— 登录 ——
function handleLogin() {
  if (!username.value.trim() || !password.value.trim()) {
    showToast('名号与密令皆不可为空')
    return
  }
  if (remember.value) localStorage.setItem('sg_user', username.value.trim())
  else localStorage.removeItem('sg_user')

  loading.value = true
  // 此处替换为真实登录接口，例如：
  // await fetch('/api/login', { method:'POST', body: JSON.stringify({...}) })
  setTimeout(() => {
    loading.value = false
    showToast('将军 ' + username.value.trim() + '，入帐成功，共图大业！')
  }, 1400)
}

// —— 注册 ——
function handleRegister() {
  const u = username.value.trim()
  const p = password.value.trim()
  const c = confirmPwd.value.trim()
  if (!u || !p) {
    showToast('名号与密令皆不可为空')
    return
  }
  if (p.length < 6) {
    showToast('虎符密令至少六位')
    return
  }
  if (p !== c) {
    showToast('两次密令不一致')
    return
  }
  loading.value = true
  // 此处替换为真实注册接口，例如：
  // await fetch('/api/register', { method:'POST', body: JSON.stringify({ username:u, password:p, faction:theme.value }) })
  setTimeout(() => {
    loading.value = false
    const f = factions.find((x) => x.key === theme.value)
    showToast('将军 ' + u + '，已入' + f.name + '麾下，可点兵入帐！')
    switchMode('login')
  }, 1400)
}
</script>

<template>
  <div class="sanguo-login" :data-theme="theme">
    <!-- 水墨山水背景 -->
    <div class="scene" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a2c20" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#140d08" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4a3826" stop-opacity="0.7" />
            <stop offset="100%" stop-color="#140d08" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 620 Q200 480 420 560 Q640 640 880 520 Q1120 410 1440 540 L1440 900 L0 900 Z" fill="url(#m2)" />
        <path d="M0 740 Q260 600 520 700 Q780 800 1040 660 Q1260 560 1440 700 L1440 900 L0 900 Z" fill="url(#m1)" />
        <g stroke="var(--gold)" stroke-opacity="0.35" fill="none" stroke-width="2">
          <path d="M180 720 L180 600" />
          <path d="M180 640 L150 615 M180 640 L210 615 M180 615 L156 590 M180 615 L204 590 M180 600 L168 575 M180 600 L192 575" />
        </g>
        <circle cx="1180" cy="180" r="70" fill="#f3e9d6" fill-opacity="0.12" />
        <circle cx="1180" cy="180" r="70" fill="none" stroke="var(--gold)" stroke-opacity="0.25" stroke-width="1.5" />
      </svg>
      <div class="cloud c1"></div>
      <div class="cloud c2"></div>
      <div class="cloud c3"></div>
    </div>

    <!-- 登录卡片 -->
    <div class="login-wrap">
      <div class="brand">
        <div class="seal">汉</div>
        <div class="title">三国</div>
        <div class="subtitle">天下大势 · 分久必合</div>
      </div>

      <!-- 登录 / 注册 切换 -->
      <div class="tabs">
        <button type="button" class="tab" :class="{ active: mode === 'login' }" @click="switchMode('login')">登 录</button>
        <button type="button" class="tab" :class="{ active: mode === 'register' }" @click="switchMode('register')">注 册</button>
      </div>

      <!-- 登录表单 -->
      <form v-if="mode === 'login'" class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="username">将 军 名 号</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
            </svg>
            <input id="username" v-model="username" type="text" placeholder="请输入账号" />
          </div>
        </div>

        <div class="field">
          <label for="password">虎 符 密 令</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input id="password" v-model="password" :type="showPwd ? 'text' : 'password'" placeholder="请输入密码" />
            <button type="button" class="toggle-eye" @click="showPwd = !showPwd" :aria-label="showPwd ? '隐藏密码' : '显示密码'">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6" v-html="eyeIcon"></svg>
            </button>
          </div>
        </div>

        <div class="options">
          <label class="remember"><input type="checkbox" v-model="remember" /> 铭记吾名</label>
          <a class="link" href="#" @click.prevent>忘了密令？</a>
        </div>

        <button class="btn-login" type="submit" :class="{ loading }" :disabled="loading">
          {{ loading ? '点兵中…' : '登 录' }}
        </button>

        <div class="switch-line">
          尚无账号？<a class="link" href="#" @click.prevent="switchMode('register')">前往注册</a>
        </div>
      </form>

      <!-- 注册表单 -->
      <form v-else class="login-form" @submit.prevent="handleRegister">
        <div class="field">
          <label for="reg-username">将 军 名 号</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
            </svg>
            <input id="reg-username" v-model="username" type="text" placeholder="请设账号名号" />
          </div>
        </div>

        <div class="field">
          <label for="reg-password">虎 符 密 令</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input id="reg-password" v-model="password" :type="showPwd ? 'text' : 'password'" placeholder="至少六位" />
            <button type="button" class="toggle-eye" @click="showPwd = !showPwd" :aria-label="showPwd ? '隐藏密码' : '显示密码'">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6" v-html="eyeIcon"></svg>
            </button>
          </div>
        </div>

        <div class="field">
          <label for="reg-confirm">再 验 密 令</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <input id="reg-confirm" v-model="confirmPwd" :type="showPwd ? 'text' : 'password'" placeholder="请再次输入密令" />
          </div>
        </div>

        <button class="btn-login" type="submit" :class="{ loading }" :disabled="loading">
          {{ loading ? '入册中…' : '注 册' }}
        </button>

        <div class="switch-line">
          已有账号？<a class="link" href="#" @click.prevent="switchMode('login')">返回登录</a>
        </div>
      </form>

      <!-- 阵营选择（两种模式共用） -->
      <div class="factions">
        <button
          v-for="f in factions"
          :key="f.key"
          type="button"
          class="faction"
          :class="{ active: theme === f.key }"
          :data-f="f.key"
          @click="pickFaction(f.key)"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="hint">凭此印信，入主中原</div>
    </div>

    <transition name="fade">
      <div class="toast" v-if="toastMsg">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<style scoped>
.sanguo-login {
  --paper: #f3e9d6;
  --gold: #d4af37;
  --gold-soft: #e8c86a;
  --primary: #b22222;
  --primary-deep: #7a1414;
  --accent-glow: rgba(178, 34, 34, 0.7);

  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--paper);
  font-family: "Noto Serif SC", "Songti SC", serif;
  background: radial-gradient(circle at 30% 20%, #2b2018 0%, #140d08 70%, #0a0705 100%);
}
.sanguo-login[data-theme="shu"] { --primary: #2e8b57; --primary-deep: #1b5e3a; --accent-glow: rgba(46, 139, 87, 0.7); }
.sanguo-login[data-theme="wei"] { --primary: #2f6fb0; --primary-deep: #1c4a7a; --accent-glow: rgba(47, 111, 176, 0.7); }
.sanguo-login[data-theme="wu"]  { --primary: #1f9e8f; --primary-deep: #127065; --accent-glow: rgba(31, 158, 143, 0.7); }

/* 背景 */
.scene { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.scene svg { width: 100%; height: 100%; display: block; }

.cloud {
  position: absolute;
  background: radial-gradient(ellipse at center, rgba(243, 233, 214, 0.18), transparent 70%);
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.5;
  animation: drift 26s linear infinite;
}
.cloud.c1 { width: 380px; height: 160px; top: 12%; left: -20%; }
.cloud.c2 { width: 280px; height: 120px; top: 55%; left: -30%; animation-duration: 34s; }
.cloud.c3 { width: 460px; height: 190px; top: 78%; left: -40%; animation-duration: 42s; }
@keyframes drift { from { transform: translateX(0); } to { transform: translateX(160vw); } }

/* 卡片 */
.login-wrap {
  position: relative;
  z-index: 2;
  width: 420px;
  max-width: 92vw;
  padding: 46px 40px 34px;
  background: linear-gradient(160deg, rgba(26, 20, 16, 0.92), rgba(20, 13, 8, 0.96));
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(212, 175, 55, 0.12);
  backdrop-filter: blur(4px);
  opacity: 0;
  transform: translateY(26px) scale(0.98);
  animation: rise 0.9s cubic-bezier(0.2, 0.8, 0.25, 1) 0.15s forwards;
}
.login-wrap::before {
  content: "";
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 6px;
  pointer-events: none;
}
@keyframes rise { to { opacity: 1; transform: translateY(0) scale(1); } }

.brand { display: flex; flex-direction: column; align-items: center; margin-bottom: 22px; }
.seal {
  width: 66px; height: 66px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: var(--primary);
  font-family: "Ma Shan Zheng", cursive;
  font-size: 30px; line-height: 1;
  transform: rotate(-6deg);
  box-shadow: 0 0 0 2px var(--accent-glow);
  margin-bottom: 14px;
  transition: color 0.4s, border-color 0.4s, box-shadow 0.4s;
}
.title {
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 34px;
  letter-spacing: 10px;
  color: var(--gold-soft);
  text-shadow: 0 2px 10px rgba(212, 175, 55, 0.35);
  padding-left: 10px;
}
.subtitle {
  margin-top: 8px;
  font-family: "Ma Shan Zheng", cursive;
  font-size: 15px;
  color: rgba(243, 233, 214, 0.6);
  letter-spacing: 2px;
}

/* 登录/注册 标签页 */
.tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
.tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(243, 233, 214, 0.55);
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 18px;
  letter-spacing: 6px;
  padding: 4px 6px 8px;
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s;
}
.tab:hover { color: var(--paper); }
.tab.active { color: var(--gold-soft); border-bottom-color: var(--primary); }

.field { position: relative; margin-bottom: 22px; }
.field label {
  display: block;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--gold);
  margin-bottom: 8px;
}
.input-box {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(212, 175, 55, 0.4);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.input-box:focus-within {
  border-color: var(--gold);
  box-shadow: 0 6px 14px -10px rgba(212, 175, 55, 0.6);
}
.icon { width: 22px; height: 22px; margin-right: 10px; flex: 0 0 auto; opacity: 0.8; }
input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--paper);
  font-family: inherit;
  font-size: 16px;
  padding: 10px 0;
  letter-spacing: 1px;
}
input::placeholder { color: rgba(243, 233, 214, 0.35); }
.toggle-eye { background: none; border: none; cursor: pointer; padding: 4px; display: flex; }
.toggle-eye svg { width: 20px; height: 20px; opacity: 0.65; }
.toggle-eye:hover svg { opacity: 1; }

.options {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: rgba(243, 233, 214, 0.7); margin: 4px 0 26px;
}
.remember { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.remember input { accent-color: var(--gold); width: 15px; height: 15px; }
.link { color: var(--gold-soft); text-decoration: none; transition: color 0.2s; }
.link:hover { color: #fff; }

.switch-line { text-align: center; margin-top: 18px; font-size: 13px; color: rgba(243, 233, 214, 0.6); }

.btn-login {
  width: 100%;
  padding: 13px 0;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
  color: #fff;
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 19px;
  letter-spacing: 14px;
  padding-left: 14px;
  cursor: pointer;
  box-shadow: 0 8px 22px -8px var(--accent-glow), inset 0 0 0 1px rgba(212, 175, 55, 0.5);
  transition: transform 0.15s, box-shadow 0.25s, filter 0.2s, background 0.4s;
}
.btn-login:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 12px 30px -8px var(--accent-glow), inset 0 0 0 1px rgba(212, 175, 55, 0.7); }
.btn-login:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
.btn-login.loading { opacity: 0.85; letter-spacing: 6px; cursor: default; }

.factions { display: flex; justify-content: center; gap: 14px; margin-top: 24px; }
.faction {
  cursor: pointer;
  border: 1px solid rgba(212, 175, 55, 0.3);
  background: transparent;
  color: rgba(243, 233, 214, 0.6);
  border-radius: 20px;
  padding: 5px 16px;
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 14px;
  letter-spacing: 3px;
  transition: all 0.25s;
}
.faction:hover { color: var(--paper); border-color: rgba(212, 175, 55, 0.6); }
.faction.active { color: #fff; font-weight: 600; }
.faction[data-f="shu"].active { border-color: #2e8b57; background: rgba(46, 139, 87, 0.18); }
.faction[data-f="wei"].active { border-color: #2f6fb0; background: rgba(47, 111, 176, 0.18); }
.faction[data-f="wu"].active  { border-color: #1f9e8f; background: rgba(31, 158, 143, 0.18); }
.faction[data-f="han"].active { border-color: var(--primary); background: rgba(178, 34, 34, 0.18); }

.hint { text-align: center; margin-top: 16px; font-size: 12px; color: rgba(243, 233, 214, 0.4); }

/* Toast */
.toast {
  position: fixed;
  top: 26px; left: 50%;
  transform: translateX(-50%);
  background: rgba(26, 20, 16, 0.95);
  border: 1px solid var(--gold);
  color: var(--gold-soft);
  padding: 10px 22px;
  border-radius: 6px;
  font-family: "ZCOOL XiaoWei", serif;
  letter-spacing: 2px;
  z-index: 5;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.35s, transform 0.35s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-20px); }

@media (max-width: 480px) {
  .login-wrap { padding: 36px 24px 28px; }
  .title { font-size: 28px; letter-spacing: 8px; }
  .btn-login { letter-spacing: 10px; padding-left: 10px; }
}
</style>
