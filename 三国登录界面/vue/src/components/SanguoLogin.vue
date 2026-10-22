<script setup>
import { ref, computed, onMounted } from 'vue'
import { spawnInkRipple } from '../composables/useTheme'

const emit = defineEmits(['login-success'])

/* ---------------- 阵营 ---------------- */
const FACTIONS = [
  { key: 'han', label: '汉', name: '汉室' },
  { key: 'wei', label: '魏', name: '曹魏' },
  { key: 'shu', label: '蜀', name: '蜀汉' },
  { key: 'wu', label: '吴', name: '东吴' }
]

const mode = ref('login')
const faction = ref('han')
const currentFaction = computed(
  () => FACTIONS.find((f) => f.key === faction.value) || FACTIONS[0]
)
const sealText = computed(() => currentFaction.value.label)

function pickFaction(key) {
  faction.value = key
  toast(`已择 ${currentFaction.value.name} 之旗`)
}

/* ---------------- 表单状态 ---------------- */
const username = ref('')
const password = ref('')
const confirm = ref('')
const remember = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const showSuccess = ref(false)
const loginResult = ref(null)

const errors = ref({ username: '', password: '', confirm: '' })

function clearErrors() {
  errors.value = { username: '', password: '', confirm: '' }
}

/* 密码强度：长度 / 大小写混合 / 数字 / 特殊字符，上限 4 级 */
const strength = computed(() => {
  const pwd = password.value
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return Math.min(score, 4)
})
const STRENGTH_LABELS = ['', '弱', '中', '强', '极强']

const eyePaths = computed(() =>
  showPassword.value
    ? '<path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 3M6.1 6.1A13 13 0 0 0 2 12s3.5 7 10 7a9.4 9.4 0 0 0 3.9-.8"/>'
    : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
)

/* 记住账号 */
onMounted(() => {
  const saved = localStorage.getItem('sg_user')
  if (saved) {
    username.value = saved
    remember.value = true
  }
})

/* 飘落花瓣（随机参数，仅生成一次） */
const petals = Array.from({ length: 14 }, () => ({
  left: Math.random() * 100,
  size: 5 + Math.random() * 7,
  duration: 9 + Math.random() * 11,
  delay: Math.random() * 14,
  drift: Math.random() * 60 - 30
}))

/* 飞鸟阵型 */
const flocks = [
  {
    top: '15%',
    dur: 46,
    delay: 0,
    size: 24,
    birds: [
      { x: 0, y: 0 },
      { x: 36, y: -12 },
      { x: 70, y: 8 }
    ]
  },
  {
    top: '28%',
    dur: 62,
    delay: 16,
    size: 16,
    birds: [
      { x: 0, y: 0 },
      { x: 44, y: 14 }
    ]
  }
]

/* ---------------- 毛笔风 toast ---------------- */
const toastText = ref('')
let toastTimer = null

function toast(text) {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastText.value = ''), 2200)
}

/* ---------------- 切换登录 / 注册 ---------------- */
function switchMode(next) {
  mode.value = next
  confirm.value = ''
  clearErrors()
}

/* ---------------- 校验 ---------------- */
function validateLogin() {
  clearErrors()
  let ok = true
  if (!username.value.trim()) {
    errors.value.username = '名号不可为空'
    ok = false
  }
  if (!password.value.trim()) {
    errors.value.password = '密令不可为空'
    ok = false
  }
  return ok
}

function validateRegister() {
  clearErrors()
  let ok = true
  const name = username.value.trim()
  const pwd = password.value.trim()
  const cfm = confirm.value.trim()

  if (!name) {
    errors.value.username = '名号不可为空'
    ok = false
  } else if (name.length < 2) {
    errors.value.username = '名号至少二字'
    ok = false
  }

  if (!pwd) {
    errors.value.password = '密令不可为空'
    ok = false
  } else if (pwd.length < 6) {
    errors.value.password = '虎符密令至少六位'
    ok = false
  }

  if (pwd && cfm && pwd !== cfm) {
    errors.value.confirm = '两次密令不一致'
    ok = false
  }
  return ok
}

/* ---------------- 登录 ---------------- */
async function handleLogin() {
  if (!validateLogin()) return

  if (remember.value) {
    localStorage.setItem('sg_user', username.value.trim())
  } else {
    localStorage.removeItem('sg_user')
  }

  loading.value = true
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value
      })
    })
    const data = await res.json()

    if (data.success) {
      loginResult.value = data.data || null
      if (loginResult.value && loginResult.value.faction) {
        faction.value = loginResult.value.faction
      }
      showSuccess.value = true
    } else {
      toast(data.message || '登录失败')
    }
  } catch {
    toast('与服务器失联，请确认后端已启动')
  } finally {
    loading.value = false
  }
}

/* ---------------- 注册 ---------------- */
async function handleRegister() {
  if (!validateRegister()) return

  loading.value = true
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
        faction: faction.value
      })
    })
    const data = await res.json()

    if (data.success) {
      toast(`将军 ${username.value.trim()}，已入${currentFaction.value.name}麾下，可点兵入帐！`)
      switchMode('login')
    } else {
      toast(data.message || '注册失败')
    }
  } catch {
    toast('与服务器失联，请确认后端已启动')
  } finally {
    loading.value = false
  }
}

/* ---------------- 入帐成功 ---------------- */
function enterHome() {
  showSuccess.value = false
  const info = loginResult.value || {}
  emit('login-success', {
    username: (info.username || username.value || '').trim(),
    faction: info.faction || faction.value,
    factionName: info.factionName || currentFaction.value.name,
    createTime: info.createTime || '',
    /* 后端签发 JWT，后续所有接口都要带它 */
    token: info.token || ''
  })
}

function forgotPassword() {
  toast('密令已托付烽火台，速往查证')
}

/* 试看：一键填入演示账号 */
function fillDemo() {
  username.value = '云长'
  password.value = 'danfeng123'
  confirm.value = ''
  clearErrors()
  toast('已填入演示账号，可直接登录')
}
</script>

<template>
  <div class="sanguo-login" :data-theme="faction">
    <!-- 水墨山水场景 -->
    <div class="scene" aria-hidden="true">
      <div class="moon"></div>
      <div class="sky">
        <div
          v-for="(flock, fi) in flocks"
          :key="'f' + fi"
          class="flock"
          :style="{
            top: flock.top,
            animationDuration: flock.dur + 's',
            animationDelay: flock.delay + 's'
          }"
        >
          <span
            v-for="(bird, bi) in flock.birds"
            :key="'b' + bi"
            class="bird"
            :style="{
              width: flock.size + 'px',
              marginLeft: bird.x + 'px',
              marginTop: bird.y + 'px'
            }"
          >
            <svg
              viewBox="0 0 24 12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M1 6 Q6 0 12 6 Q18 0 23 6" />
            </svg>
          </span>
        </div>
      </div>

      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path
          class="mtn-far"
          d="M0 560 Q300 460 600 540 Q900 620 1200 500 Q1320 470 1440 520 L1440 900 L0 900 Z"
          fill="var(--mtn-far)"
        />
        <path
          class="mtn-mid"
          d="M0 620 Q200 480 420 560 Q640 640 880 520 Q1120 410 1440 540 L1440 900 L0 900 Z"
          fill="var(--mtn1)"
        />
        <path
          class="mtn-front"
          d="M0 740 Q260 600 520 700 Q780 800 1040 660 Q1260 560 1440 700 L1440 900 L0 900 Z"
          fill="var(--mtn2)"
        />
        <g class="mtn" stroke="var(--gold)" stroke-opacity="0.35" fill="none" stroke-width="2">
          <path d="M180 720 L180 600" />
          <path d="M180 640 L150 615 M180 640 L210 615 M180 615 L156 590 M180 615 L204 590 M180 600 L168 575 M180 600 L192 575" />
        </g>
      </svg>

      <div class="cloud c1"></div>
      <div class="cloud c2"></div>
      <div class="cloud c3"></div>
      <div class="mist"></div>
    </div>

    <!-- 飘落花瓣 -->
    <div class="petals" aria-hidden="true">
      <span
        v-for="(petal, pi) in petals"
        :key="'p' + pi"
        class="petal"
        :style="{
          left: petal.left + '%',
          width: petal.size + 'px',
          height: petal.size + 'px',
          animationDuration: petal.duration + 's',
          animationDelay: petal.delay + 's',
          '--drift': petal.drift + 'px'
        }"
      ></span>
    </div>

    <!-- 登录卡片 -->
    <div class="login-wrap">
      <div class="brand">
        <div class="seal">{{ sealText }}</div>
        <div class="title">三国</div>
        <div class="subtitle">天下大势 · 分久必合</div>
      </div>

      <div class="tabs">
        <button
          type="button"
          :class="['tab', { active: mode === 'login' }]"
          @click="switchMode('login')"
        >
          登 录
        </button>
        <button
          type="button"
          :class="['tab', { active: mode === 'register' }]"
          @click="switchMode('register')"
        >
          注 册
        </button>
      </div>

      <!-- 登录表单 -->
      <form v-if="mode === 'login'" key="login" class="login-form" novalidate @submit.prevent="handleLogin">
        <div class="field">
          <label for="username">将 军 名 号</label>
          <div :class="['input-box', { invalid: errors.username }]">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
            </svg>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="请输入账号"
              autocomplete="username"
            />
          </div>
          <p v-if="errors.username" class="err">{{ errors.username }}</p>
        </div>

        <div class="field">
          <label for="password">虎 符 密 令</label>
          <div :class="['input-box', { invalid: errors.password }]">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="toggle-eye"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--gold)"
                stroke-width="1.6"
                v-html="eyePaths"
              ></svg>
            </button>
          </div>
          <p v-if="errors.password" class="err">{{ errors.password }}</p>
        </div>

        <div class="options">
          <label class="remember">
            <input v-model="remember" type="checkbox" /> 铭记吾名
          </label>
          <a class="link" href="#" @click.prevent="forgotPassword">忘了密令？</a>
        </div>

        <button :class="['btn-login', { loading }]" type="submit" :disabled="loading">
          {{ loading ? '点兵中…' : '登 录' }}
        </button>

        <div class="switch-line">
          尚无账号？
          <a class="link" href="#" @click.prevent="switchMode('register')">前往注册</a>
          <span class="sep">·</span>
          <a class="link" href="#" @click.prevent="fillDemo">试看</a>
        </div>
      </form>

      <!-- 注册表单 -->
      <form v-else key="register" class="login-form" novalidate @submit.prevent="handleRegister">
        <div class="field">
          <label for="reg-username">将 军 名 号</label>
          <div :class="['input-box', { invalid: errors.username }]">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
            </svg>
            <input
              id="reg-username"
              v-model="username"
              type="text"
              placeholder="请设账号名号"
              autocomplete="username"
            />
          </div>
          <p v-if="errors.username" class="err">{{ errors.username }}</p>
        </div>

        <div class="field">
          <label for="reg-password">虎 符 密 令</label>
          <div :class="['input-box', { invalid: errors.password }]">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="reg-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="至少六位"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="toggle-eye"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--gold)"
                stroke-width="1.6"
                v-html="eyePaths"
              ></svg>
            </button>
          </div>
          <p v-if="errors.password" class="err">{{ errors.password }}</p>

          <div v-if="password" class="strength">
            <span
              v-for="i in 4"
              :key="i"
              :class="{ on: i <= strength, ['lv' + strength]: i === strength }"
            ></span>
          </div>
          <div v-if="password" class="strength-label">{{ STRENGTH_LABELS[strength] }}</div>
        </div>

        <div class="field">
          <label for="reg-confirm">再 验 密 令</label>
          <div :class="['input-box', { invalid: errors.confirm }]">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.6">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <input
              id="reg-confirm"
              v-model="confirm"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请再次输入密令"
              autocomplete="new-password"
            />
          </div>
          <p v-if="errors.confirm" class="err">{{ errors.confirm }}</p>
        </div>

        <button :class="['btn-login', { loading }]" type="submit" :disabled="loading">
          {{ loading ? '入册中…' : '注 册' }}
        </button>

        <div class="switch-line">
          已有账号？
          <a class="link" href="#" @click.prevent="switchMode('login')">返回登录</a>
        </div>
      </form>

      <!-- 阵营切换 -->
      <div class="factions">
        <button
          v-for="f in FACTIONS"
          :key="f.key"
          type="button"
          :class="['faction', { active: faction === f.key }]"
          :data-f="f.key"
          @click="pickFaction(f.key)"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="hint">凭此印信，入主中原</div>
    </div>

    <!-- 入帐成功 · 盖印 -->
    <Transition name="stamp">
      <div v-if="showSuccess" class="success-mask" @click.self="enterHome">
        <div class="success-card">
          <div class="stamp">{{ sealText }}</div>
          <div class="success-title">入 帐 成 功</div>
          <div class="success-sub">将军 {{ username.trim() }}，共图大业！</div>
          <button class="btn-login" type="button" @click="enterHome">入主中原</button>
        </div>
      </div>
    </Transition>

    <!-- toast -->
    <Transition name="fade">
      <div v-if="toastText" class="toast">{{ toastText }}</div>
    </Transition>
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
  --petal: rgba(212, 175, 55, 0.85);
  --bird: rgba(243, 233, 214, 0.45);
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--paper);
  font-family: "Noto Serif SC", "Songti SC", serif;
  background: radial-gradient(circle at 30% 20%, var(--sky-1) 0%, var(--sky-2) 70%, var(--sky-3) 100%);
  transition: --sky-1 0.7s ease, --sky-2 0.7s ease, --sky-3 0.7s ease;
}

/* 汉（默认） */
.sanguo-login[data-theme="han"] {
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
  --petal: rgba(212, 175, 55, 0.85);
  --bird: rgba(243, 233, 214, 0.45);
}

/* 魏 */
.sanguo-login[data-theme="wei"] {
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
  --petal: rgba(150, 190, 230, 0.85);
  --bird: rgba(200, 220, 240, 0.45);
}

/* 蜀 */
.sanguo-login[data-theme="shu"] {
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
  --petal: rgba(120, 200, 150, 0.85);
  --bird: rgba(210, 235, 215, 0.45);
}

/* 吴 */
.sanguo-login[data-theme="wu"] {
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
  --petal: rgba(120, 210, 200, 0.85);
  --bird: rgba(200, 232, 232, 0.45);
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
  top: 9%;
  right: 13%;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle at 42% 40%, var(--moon) 0%, transparent 70%);
  box-shadow: 0 0 60px 12px var(--moon-glow-a);
  animation: moonGlow 8s ease-in-out infinite;
  transition: --moon 0.7s ease, box-shadow 0.6s ease;
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
  animation: drift 26s linear infinite;
  transition: background 0.6s ease;
}
.cloud.c1 {
  width: 380px;
  height: 160px;
  top: 12%;
  left: -20%;
}
.cloud.c2 {
  width: 280px;
  height: 120px;
  top: 55%;
  left: -30%;
  animation-duration: 34s;
}
.cloud.c3 {
  width: 460px;
  height: 190px;
  top: 78%;
  left: -40%;
  animation-duration: 42s;
}
@keyframes drift {
  0% {
    transform: translate(0);
  }
  100% {
    transform: translate(160vw);
  }
}

.sky {
  position: absolute;
  inset: 0;
}
.flock {
  position: absolute;
  left: -12%;
  display: flex;
  animation: fly linear infinite;
}
@keyframes fly {
  0% {
    transform: translate(0);
  }
  100% {
    transform: translate(135vw);
  }
}
.bird {
  color: var(--bird);
  display: block;
}
.bird svg {
  width: 100%;
  height: auto;
  display: block;
}

.mtn-far,
.mtn-mid,
.mtn-front {
  transition: fill 0.6s ease;
}
.mtn-far {
  animation: mtnFar 26s ease-in-out infinite alternate;
  transform-origin: 50% 100%;
}
.mtn {
  animation: mtnBreath 18s ease-in-out infinite alternate;
  transform-origin: 50% 100%;
}
@keyframes mtnFar {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-6px);
  }
}
@keyframes mtnBreath {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-10px);
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
  transition: background 0.6s ease;
}
@keyframes mistDrift {
  0% {
    transform: translate(-4%);
  }
  100% {
    transform: translate(4%);
  }
}

/* ---------- 花瓣 ---------- */
.petals {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.petal {
  position: absolute;
  top: -5%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--petal) 0%, transparent 70%);
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes fall {
  0% {
    transform: translateY(-10vh) translate(0);
    opacity: 0;
  }
  12% {
    opacity: 0.9;
  }
  88% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(110vh) translate(var(--drift));
    opacity: 0;
  }
}

/* ---------- 登录卡片 ---------- */
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
@keyframes rise {
  to {
    opacity: 1;
    transform: none;
  }
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}
.seal {
  width: 66px;
  height: 66px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-family: "Ma Shan Zheng", cursive;
  font-size: 30px;
  line-height: 1;
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

/* ---------- 标签页 ---------- */
.tabs {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;
}
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
.tab:hover {
  color: var(--paper);
}
.tab.active {
  color: var(--gold-soft);
  border-bottom-color: var(--primary);
}

/* ---------- 表单 ---------- */
.field {
  position: relative;
  margin-bottom: 22px;
}
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
.input-box.invalid {
  border-color: #e0584b;
  box-shadow: 0 6px 14px -10px rgba(224, 88, 75, 0.5);
}
.icon {
  width: 22px;
  height: 22px;
  margin-right: 10px;
  flex: 0 0 auto;
  opacity: 0.8;
}
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
input::placeholder {
  color: rgba(243, 233, 214, 0.35);
}
.toggle-eye {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
}
.toggle-eye svg {
  width: 20px;
  height: 20px;
  opacity: 0.65;
}
.toggle-eye:hover svg {
  opacity: 1;
}
.err {
  margin: 7px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: #e0584b;
}

/* 密码强度 */
.strength {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}
.strength span {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(243, 233, 214, 0.16);
  transition: background 0.3s, box-shadow 0.3s;
}
.strength span.on {
  background: var(--gold);
}
.strength span.lv1.on {
  background: #e0584b;
  box-shadow: 0 0 8px -2px #e0584b;
}
.strength span.lv2.on {
  background: #e8a13a;
  box-shadow: 0 0 8px -2px #e8a13a;
}
.strength span.lv3.on {
  background: var(--gold);
  box-shadow: 0 0 8px -2px var(--gold);
}
.strength span.lv4.on {
  background: #4caf72;
  box-shadow: 0 0 8px -2px #4caf72;
}
.strength-label {
  margin-top: 5px;
  font-size: 11px;
  letter-spacing: 2px;
  text-align: right;
  color: rgba(243, 233, 214, 0.5);
}

/* 选项行 */
.options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: rgba(243, 233, 214, 0.7);
  margin: 4px 0 26px;
}
.remember {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}
.remember input {
  accent-color: var(--gold);
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.link {
  color: var(--gold-soft);
  text-decoration: none;
  transition: color 0.2s;
  cursor: pointer;
}
.link:hover {
  color: #fff;
}
.sep {
  color: rgba(243, 233, 214, 0.3);
  margin: 0 2px;
}
.switch-line {
  text-align: center;
  margin-top: 18px;
  font-size: 13px;
  color: rgba(243, 233, 214, 0.6);
}

/* 主按钮 */
.btn-login {
  width: 100%;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%);
  color: #fff;
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 19px;
  letter-spacing: 14px;
  padding: 13px 0 13px 14px;
  cursor: pointer;
  box-shadow: 0 8px 22px -8px var(--accent-glow), inset 0 0 0 1px rgba(212, 175, 55, 0.5);
  transition: transform 0.15s, box-shadow 0.25s, filter 0.2s, background 0.4s;
}
.btn-login:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 12px 30px -8px var(--accent-glow), inset 0 0 0 1px rgba(212, 175, 55, 0.7);
}
.btn-login:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}
.btn-login.loading {
  opacity: 0.85;
  letter-spacing: 6px;
  cursor: default;
}

/* 阵营选择 */
.factions {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 24px;
}
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
.faction:hover {
  color: var(--paper);
  border-color: rgba(212, 175, 55, 0.6);
}
.faction.active {
  color: #fff;
  font-weight: 600;
}
.faction[data-f="shu"].active {
  border-color: #2e8b57;
  background: rgba(46, 139, 87, 0.18);
}
.faction[data-f="wei"].active {
  border-color: #2f6fb0;
  background: rgba(47, 111, 176, 0.18);
}
.faction[data-f="wu"].active {
  border-color: #1f9e8f;
  background: rgba(31, 158, 143, 0.18);
}
.faction[data-f="han"].active {
  border-color: var(--primary);
  background: rgba(178, 34, 34, 0.18);
}
.hint {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: rgba(243, 233, 214, 0.4);
}

/* ---------- 入帐成功 ---------- */
.success-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 5, 3, 0.78);
  backdrop-filter: blur(3px);
}
.success-card {
  text-align: center;
  padding: 30px 44px;
}
.stamp {
  width: 120px;
  height: 120px;
  margin: 0 auto 18px;
  border: 4px solid var(--primary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-family: "Ma Shan Zheng", cursive;
  font-size: 64px;
  line-height: 1;
  transform: rotate(-8deg);
  box-shadow: 0 0 0 4px var(--accent-glow);
  animation: stampIn 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
@keyframes stampIn {
  0% {
    opacity: 0;
    transform: rotate(-8deg) scale(2.2);
  }
  60% {
    opacity: 1;
    transform: rotate(-8deg) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: rotate(-8deg) scale(1);
  }
}
.success-title {
  font-family: "ZCOOL XiaoWei", serif;
  font-size: 26px;
  letter-spacing: 10px;
  color: var(--gold-soft);
  padding-left: 10px;
  text-shadow: 0 2px 12px rgba(212, 175, 55, 0.4);
}
.success-sub {
  margin: 12px 0 26px;
  font-size: 15px;
  color: rgba(243, 233, 214, 0.7);
  letter-spacing: 2px;
}
.success-card .btn-login {
  width: 200px;
  margin: 0 auto;
}

/* ---------- toast ---------- */
.toast {
  position: fixed;
  top: 26px;
  left: 50%;
  transform: translate(-50%);
  background: rgba(26, 20, 16, 0.95);
  border: 1px solid var(--gold);
  color: var(--gold-soft);
  padding: 10px 22px;
  border-radius: 6px;
  font-family: "ZCOOL XiaoWei", serif;
  letter-spacing: 2px;
  z-index: 5;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s, transform 0.35s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%) translateY(-20px);
}
.stamp-enter-active,
.stamp-leave-active {
  transition: opacity 0.3s;
}
.stamp-enter-from,
.stamp-leave-to {
  opacity: 0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 480px) {
  .login-wrap {
    padding: 36px 24px 28px;
  }
  .title {
    font-size: 28px;
    letter-spacing: 8px;
  }
  .btn-login {
    letter-spacing: 10px;
    padding-left: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud,
  .moon,
  .flock,
  .petal,
  .mist,
  .mtn,
  .mtn-far {
    animation: none;
  }
  .login-wrap {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .stamp {
    animation: none;
  }
}
</style>
