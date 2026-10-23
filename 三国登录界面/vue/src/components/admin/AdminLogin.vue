<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminFetch, setAdminSession } from '../../composables/useAdmin'

const emit = defineEmits(['login-success', 'back'])

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const showPwd = ref(false)
const pwdInput = ref(null)
const userInput = ref(null)

const canSubmit = computed(
  () => username.value.trim().length > 0 && password.value.length > 0 && !loading.value
)

onMounted(() => {
  if (userInput.value) userInput.value.focus()
})

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = ''
  const { status, body } = await adminFetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.value.trim(), password: password.value })
  })
  loading.value = false

  if (status === 0) {
    errorMsg.value = '与军中失联，请确认后端服务已启动'
    return
  }
  if (!body || !body.success) {
    errorMsg.value = (body && body.message) || '登录失败，请重试'
    password.value = ''
    return
  }
  setAdminSession(body.data)
  emit('login-success', body.data)
}

function fillDemo() {
  username.value = 'admin'
  password.value = 'admin123'
  errorMsg.value = ''
  if (pwdInput.value) pwdInput.value.focus()
}
</script>

<template>
  <div class="admin-login">
    <div class="bg-ink" aria-hidden="true">
      <div class="halo"></div>
      <div class="grid-lines"></div>
    </div>

    <header class="lg-top">
      <button class="lnk" type="button" @click="emit('back')">← 返回前台</button>
      <span class="lg-tag">中军大帐 · 后台管理</span>
    </header>

    <main class="lg-main">
      <section class="lg-card">
        <div class="lg-head">
          <div class="seal">令</div>
          <div>
            <h1>后台管理</h1>
            <p>仅限执掌印信者入内 · 无注册入口</p>
          </div>
        </div>

        <form class="lg-form" @submit.prevent="submit">
          <label class="field">
            <span class="lb">管理账号</span>
            <input
              ref="userInput"
              v-model="username"
              type="text"
              autocomplete="username"
              placeholder="请输入管理账号"
              :disabled="loading"
            />
          </label>

          <label class="field">
            <span class="lb">登录密码</span>
            <div class="pwd-wrap">
              <input
                ref="pwdInput"
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入登录密码"
                :disabled="loading"
              />
              <button
                class="eye"
                type="button"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                @click="showPwd = !showPwd"
              >
                {{ showPwd ? '隐' : '显' }}
              </button>
            </div>
          </label>

          <p v-if="errorMsg" class="err" role="alert">{{ errorMsg }}</p>

          <button class="btn-primary" type="submit" :disabled="!canSubmit">
            {{ loading ? '验印中…' : '登 录' }}
          </button>
        </form>

        <div class="lg-foot">
          <button class="lnk small" type="button" @click="fillDemo">填入演示账号</button>
          <span class="hint">演示：admin / admin123</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-login {
  --a-gold: #d4af37;
  --a-gold-soft: #e8c86a;
  --a-text: #f3e9d6;
  --a-dim: rgba(243, 233, 214, 0.62);
  --a-faint: rgba(243, 233, 214, 0.4);
  --a-panel: linear-gradient(160deg, rgba(30, 22, 16, 0.96), rgba(18, 12, 8, 0.98));
  --a-hair: rgba(212, 175, 55, 0.32);
  --a-field: rgba(243, 233, 214, 0.06);
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  color: var(--a-text);
  font-family: var(--font-body);
  background: radial-gradient(circle at 28% 18%, #2a1f16 0%, #170f0a 62%, #0a0604 100%);
  overflow: hidden;
}

.bg-ink {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.halo {
  position: absolute;
  width: 620px;
  height: 620px;
  right: -140px;
  top: -220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.16), rgba(212, 175, 55, 0) 68%);
}
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(212, 175, 55, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212, 175, 55, 0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(circle at 50% 40%, rgba(0, 0, 0, 0.9), transparent 78%);
}

.lg-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
}
.lg-tag {
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--a-faint);
}
.lnk {
  background: none;
  border: none;
  color: var(--a-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
  letter-spacing: 1px;
  transition: color 0.2s ease;
}
.lnk:hover {
  color: var(--a-gold-soft);
}
.lnk.small {
  font-size: 12.5px;
}

.lg-main {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 12px 20px 56px;
}

.lg-card {
  width: min(420px, 100%);
  padding: 32px 30px 26px;
  border: 1px solid var(--a-hair);
  border-radius: 14px;
  background: var(--a-panel);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(6px);
}

.lg-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px dashed var(--a-hair);
  margin-bottom: 22px;
}
.seal {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--a-gold);
  border-radius: 8px;
  color: var(--a-gold-soft);
  font-family: var(--font-cal);
  font-size: 24px;
  line-height: 1;
}
.lg-head h1 {
  font-family: var(--font-cal);
  font-size: 22px;
  letter-spacing: 4px;
  color: var(--a-text);
}
.lg-head p {
  margin-top: 5px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--a-faint);
}

.lg-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: block;
}
.lb {
  display: block;
  font-size: 12.5px;
  letter-spacing: 2px;
  color: var(--a-dim);
  margin-bottom: 7px;
}
.field input {
  width: 100%;
  height: 44px;
  padding: 0 13px;
  border: 1px solid var(--a-hair);
  border-radius: 8px;
  background: var(--a-field);
  color: var(--a-text);
  font-family: inherit;
  font-size: 14.5px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.field input::placeholder {
  color: var(--a-faint);
}
.field input:focus {
  border-color: var(--a-gold-soft);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.14);
}
.field input:disabled {
  opacity: 0.6;
}
.pwd-wrap {
  position: relative;
}
.pwd-wrap input {
  padding-right: 48px;
}
.eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--a-faint);
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
}
.eye:hover {
  color: var(--a-gold-soft);
}

.err {
  font-size: 13px;
  color: #ff8f80;
  background: rgba(255, 90, 70, 0.1);
  border: 1px solid rgba(255, 120, 100, 0.28);
  border-radius: 7px;
  padding: 9px 12px;
  line-height: 1.5;
}

.btn-primary {
  height: 46px;
  margin-top: 4px;
  border: 1px solid var(--a-gold);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.95), rgba(160, 124, 28, 0.95));
  color: #241a08;
  font-family: var(--font-cal);
  font-size: 16px;
  letter-spacing: 6px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.25s ease, filter 0.2s ease;
}
.btn-primary:hover:not(:disabled) {
  box-shadow: 0 10px 26px -10px rgba(212, 175, 55, 0.9);
  filter: brightness(1.05);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}
.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lg-foot {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.hint {
  font-size: 12px;
  color: var(--a-faint);
  letter-spacing: 1px;
}

/* 亮色主题放在文件末尾的非 scoped 样式块中 */

@media (max-width: 480px) {
  .lg-card {
    padding: 26px 20px 22px;
  }
  .lg-head h1 {
    font-size: 19px;
    letter-spacing: 2px;
  }
}
</style>

<!-- 亮色主题：非 scoped，避免 :global 前缀写法被编译器丢弃 -->
<style>
html[data-theme='light'] .admin-login {
  --a-text: #2c2114;
  --a-dim: rgba(44, 33, 20, 0.7);
  --a-faint: rgba(44, 33, 20, 0.5);
  --a-gold: #9a6f1e;
  --a-gold-soft: #8a6119;
  --a-panel: linear-gradient(160deg, rgba(255, 251, 243, 0.98), rgba(252, 245, 230, 0.99));
  --a-hair: rgba(154, 111, 30, 0.32);
  --a-field: rgba(120, 80, 30, 0.05);
  background: radial-gradient(circle at 30% 20%, #f8f0e1, #efe2c8 70%, #e7d7b9);
}
html[data-theme='light'] .admin-login .err {
  color: #a32a1a;
  background: rgba(200, 60, 40, 0.08);
  border-color: rgba(200, 60, 40, 0.25);
}
html[data-theme='light'] .admin-login .btn-primary {
  color: #fffaf0;
  background: linear-gradient(180deg, #a97a20, #8a6119);
  border-color: #8a6119;
}
html[data-theme='light'] .admin-login .grid-lines {
  background-image: linear-gradient(rgba(154, 111, 30, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(154, 111, 30, 0.09) 1px, transparent 1px);
}
</style>
