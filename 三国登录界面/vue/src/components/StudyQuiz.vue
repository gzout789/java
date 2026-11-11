<script setup>
/**
 * 考校学识 —— 一题一屏闯关式（2026-11-11 由「一页列全部题」改造）。
 *
 * 关键设计：deck 是题库的一次性快照（浅拷贝），选中态 / 进度 / 本轮战绩全部
 * 留在组件内。父组件每次提交成功后会 loadQuiz() 刷新 questions，若直接拿
 * props.questions 渲染，当前题对象会被换掉、picked 失效，所以必须在本地留快照。
 *
 * 后端事实（QuizServiceImpl）：board() 的 answered 只在「答对」时为 true，
 * 答错不落库、可重答；answer() 返回 correct/answer/explanation/reward/repeat/earned。
 * 因此闯关队列默认只收未答对的题，答错给「再答一次」，全答对显示通关页。
 */
import { ref, computed, watch } from 'vue'
import { spawnInkRipple } from '../composables/useTheme'

const props = defineProps({
  questions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  answeringId: { type: [Number, String], default: null },
  feedback: { type: Object, default: null },
  answeredCount: { type: Number, default: 0 },
  earned: { type: Number, default: 0 },
  message: { type: String, default: '' }
})

const emit = defineEmits(['submit', 'go-study'])
const ripple = spawnInkRipple

const deck = ref([]) // 本轮题目快照
const index = ref(0)
const stage = ref('answering') // answering | feedback | summary | cleared
const shown = ref(null) // 当前题的反馈快照（不直接用 props.feedback，避免残留串题）
const results = ref([]) // [{ id, correct, reward }]，按题目去重
const reviewing = ref(false) // 温习模式：全部题重做，不计赏

const current = computed(() => deck.value[index.value] || null)
const total = computed(() => deck.value.length)
const correctCount = computed(() => results.value.filter((r) => r.correct).length)
const roundReward = computed(() => results.value.reduce((s, r) => s + (r.reward || 0), 0))
const progress = computed(() => {
  if (!total.value) return 0
  const done = index.value + (stage.value === 'feedback' || stage.value === 'summary' ? 1 : 0)
  return Math.round(Math.min(done / total.value, 1) * 100)
})
const nextLabel = computed(() =>
  index.value + 1 >= total.value ? '查看本轮结果 →' : '下一题 →'
)

/** 建一轮题目：默认只取未答对的题；review=true 时温习全部（强制可作答、不计赏） */
function buildDeck(review = false) {
  // 本轮已答对的题先本地排除：loadQuiz() 是异步的，若「再考一轮」点得早，
  // questions 可能还没刷新，避免把刚答对的题又排进新一轮。
  const solved = new Set(results.value.filter((r) => r.correct).map((r) => r.id))
  const src = review
    ? props.questions.map((q) => ({ ...q, answered: false }))
    : props.questions
        .filter((q) => !q.answered && !solved.has(q.id))
        .map((q) => ({ ...q }))
  deck.value = src.map((q) => ({ ...q, picked: '' }))
  index.value = 0
  results.value = []
  shown.value = null
  reviewing.value = review
  stage.value = deck.value.length ? 'answering' : 'cleared'
}

// 题库首次到位时自动开一轮。之后 deck 非空，父组件 loadQuiz() 刷新不会再冲掉它。
watch(
  () => props.questions,
  (list) => {
    if (list && list.length && !deck.value.length) buildDeck(false)
  },
  { immediate: true }
)

// 每次提交成功都是一个新对象，据此切到反馈态并累计本轮战绩。
watch(
  () => props.feedback,
  (fb) => {
    if (!fb || stage.value === 'summary' || stage.value === 'cleared') return
    shown.value = fb
    stage.value = 'feedback'
    const rec = {
      id: fb.questionId,
      correct: !!fb.correct,
      reward: Number(fb.reward) || 0
    }
    const i = results.value.findIndex((r) => r.id === rec.id)
    if (i >= 0) results.value[i] = rec
    else results.value.push(rec)
  }
)

function optionsOf(q) {
  return [
    { k: 'A', v: q.optionA },
    { k: 'B', v: q.optionB },
    { k: 'C', v: q.optionC },
    { k: 'D', v: q.optionD }
  ]
}

function choose(key) {
  if (stage.value !== 'answering' || !current.value) return
  current.value.picked = key
}

function optionClass(q, key) {
  const fb = shown.value
  if (!fb || stage.value !== 'feedback') return { chosen: q.picked === key }
  return {
    correct: key === fb.answer,
    wrong: q.picked === key && key !== fb.answer
  }
}

function submit() {
  const q = current.value
  if (!q || stage.value !== 'answering' || !q.picked) return
  if (props.answeringId === q.id) return
  emit('submit', q, q.picked)
}

function next() {
  shown.value = null
  if (index.value + 1 >= total.value) {
    stage.value = 'summary'
  } else {
    index.value += 1
    stage.value = 'answering'
  }
}

/** 答错后原地重答：后端不记录答错，也不发军饷，可以反复试 */
function retry() {
  shown.value = null
  if (current.value) current.value.picked = ''
  stage.value = 'answering'
}
</script>

<template>
  <div class="quiz-panel">
    <div class="quiz-intro">
      <span>
        每题答对赏 <b>100 石</b>，已答 <b>{{ answeredCount }}</b> 题、累计得军饷
        <b>+{{ earned }}</b> 石；同题不可重复得赏。
      </span>
      <button type="button" class="quiz-back" @click="emit('go-study')">← 回研读史册</button>
    </div>

    <p v-if="message" class="quiz-msg">{{ message }}</p>
    <p v-if="loading && !total" class="quiz-tip">书卷翻动中…</p>

    <!-- 全部答对 -->
    <div v-else-if="stage === 'cleared'" class="quiz-endcard">
      <div class="quiz-end-title">✒️ 群题尽破</div>
      <p class="quiz-end-sub">
        题库 {{ questions.length }} 题已尽数答对，累计得军饷 <b>+{{ earned }}</b> 石。
      </p>
      <div class="quiz-end-btns">
        <button type="button" class="quiz-next ghost" @click="buildDeck(true)">温习全部题目（不计赏）</button>
        <button type="button" class="quiz-next" @click="emit('go-study')">回研读史册</button>
      </div>
    </div>

    <!-- 空题库 -->
    <div v-else-if="!total" class="quiz-endcard">
      <div class="quiz-end-title">题库暂空</div>
      <p class="quiz-end-sub">容军师稍后再备题。</p>
    </div>

    <!-- 本轮总结 -->
    <div v-else-if="stage === 'summary'" class="quiz-endcard">
      <div class="quiz-end-title">✒️ 本轮考校毕</div>
      <div class="quiz-summary-stats">
        <div class="quiz-summary-stat">
          <span class="quiz-summary-num">{{ correctCount }}</span>
          <span class="quiz-summary-label">本轮答对</span>
        </div>
        <div class="quiz-summary-stat">
          <span class="quiz-summary-num">{{ total }}</span>
          <span class="quiz-summary-label">本轮题数</span>
        </div>
        <div class="quiz-summary-stat">
          <span class="quiz-summary-num">+{{ roundReward }}</span>
          <span class="quiz-summary-label">本轮军饷</span>
        </div>
      </div>
      <p class="quiz-end-sub">
        累计得军饷 <b>+{{ earned }}</b> 石，尚有 {{ questions.length - answeredCount }} 题未破。
      </p>
      <div class="quiz-end-btns">
        <button type="button" class="quiz-next ghost" @click="buildDeck(false)">再考一轮</button>
        <button type="button" class="quiz-next" @click="emit('go-study')">回研读史册</button>
      </div>
    </div>

    <!-- 一题一屏：作答 / 反馈 -->
    <template v-else>
      <div class="quiz-progress">
        <div class="quiz-progress-top">
          <span>第 <b>{{ index + 1 }}</b> / {{ total }} 题<span v-if="reviewing"> · 温习不计赏</span></span>
          <span>本轮答对 {{ correctCount }} · 军饷 +{{ roundReward }}</span>
        </div>
        <div class="quiz-progress-track">
          <div class="quiz-progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <article v-if="current" class="quiz-item" :class="{ feedback: stage === 'feedback' }">
        <div class="quiz-q">
          <span class="quiz-q-no">{{ index + 1 }}</span>
          <span class="quiz-q-text">{{ current.question }}</span>
          <span v-if="current.category" class="quiz-q-cat">{{ current.category }}</span>
        </div>

        <div class="quiz-opts">
          <button
            v-for="opt in optionsOf(current)"
            :key="opt.k"
            type="button"
            class="quiz-opt ink-ripple-host"
            :class="optionClass(current, opt.k)"
            :disabled="stage !== 'answering'"
            @click="choose(opt.k); ripple($event)"
          >
            <span class="quiz-opt-key">{{ opt.k }}</span>
            <span class="quiz-opt-val">{{ opt.v }}</span>
          </button>
        </div>

        <div v-if="stage === 'feedback' && shown" class="quiz-feedback">
          <div class="quiz-feedback-result" :class="{ ok: shown.correct }">
            {{ shown.correct ? '✔ 答对' : '✘ 有误' }}
            <template v-if="shown.repeat"> · 温习不计赏</template>
            <template v-else-if="shown.reward"> · 赏军饷 +{{ shown.reward }} 石</template>
          </div>
          <p class="quiz-feedback-explain">
            <b>正解 {{ shown.answer }}</b>：
            {{ shown.explanation }}
          </p>
        </div>

        <div class="quiz-actions">
          <template v-if="stage === 'answering'">
            <button
              type="button"
              class="quiz-submit ink-ripple-host"
              :disabled="answeringId === current.id || !current.picked"
              @click="submit(); ripple($event)"
            >
              {{ answeringId === current.id ? '批阅中…' : '呈交答卷' }}
            </button>
          </template>
          <template v-else>
            <button
              v-if="shown && !shown.correct"
              type="button"
              class="quiz-next ghost ink-ripple-host"
              @click="retry(); ripple($event)"
            >
              再答一次
            </button>
            <button
              type="button"
              class="quiz-next ink-ripple-host"
              @click="next(); ripple($event)"
            >
              {{ nextLabel }}
            </button>
          </template>
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
/* 2026-11-11 由 SanguoHome.vue 迁入；2026-11-11 再改为一题一屏。
   SanguoHome.vue 是 <style scoped>，组件 DOM 继承不到父级规则，样式必须整段自带。
   主题色全走 global.css 的 CSS 变量，明暗主题无需额外覆盖。 */
.quiz-panel {
  margin-top: 4px;
}
.quiz-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 4px 0 14px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-mute);
}
.quiz-intro b {
  color: var(--gold-soft);
}
.quiz-back {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: var(--gold-soft);
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  padding: 2px 0;
}
.quiz-back:hover {
  text-decoration: underline;
}
.quiz-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-faint);
}
.quiz-msg {
  margin: 0 0 10px;
  padding: 8px 12px;
  border: 1px solid var(--hair-soft);
  border-left: 3px solid var(--gold);
  border-radius: 6px;
  background: var(--surface-2);
  font-size: 12.5px;
  color: var(--text);
}

/* 闯关进度 */
.quiz-progress {
  margin: 4px 0 14px;
}
.quiz-progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-mute);
}
.quiz-progress-top b {
  font-family: var(--font-cal);
  font-size: 16px;
  color: var(--gold-soft);
}
.quiz-progress-track {
  height: 5px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}
.quiz-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--gold);
  transition: width 0.3s ease;
}

/* 单题卡片：固定最小高度，切题时下方不跟着跳 */
.quiz-item {
  border: 1px solid var(--hair-soft);
  border-radius: 10px;
  padding: 16px 18px;
  background: var(--surface-soft);
  min-height: 210px;
  transition: border-color 0.2s;
}
.quiz-item.feedback {
  border-color: var(--gold);
}
.quiz-q {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}
.quiz-q-no {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gold);
  border-radius: 50%;
  font-family: var(--font-cal);
  font-size: 12px;
  color: var(--gold-soft);
}
.quiz-q-text {
  flex: 1;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text);
}
.quiz-q-cat {
  flex: 0 0 auto;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-faint);
  border: 1px solid var(--hair-soft);
  border-radius: 3px;
  padding: 1px 6px;
}

.quiz-opts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.quiz-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--hair-soft);
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.quiz-opt:hover:not(:disabled) {
  border-color: var(--gold);
  background: var(--surface-2);
}
.quiz-opt:disabled {
  cursor: default;
}
.quiz-opt-key {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hair);
  border-radius: 4px;
  font-size: 11px;
  color: var(--gold-soft);
}
.quiz-opt-val {
  font-size: 13px;
  line-height: 1.5;
}
.quiz-opt.chosen {
  border-color: var(--gold);
  background: var(--surface-2);
}
.quiz-opt.correct {
  border-color: #3aa66a;
  background: rgba(58, 166, 106, 0.14);
}
.quiz-opt.correct .quiz-opt-key {
  border-color: #3aa66a;
  color: #5fd58d;
}
.quiz-opt.wrong {
  border-color: #d95f5f;
  background: rgba(217, 95, 95, 0.14);
}
.quiz-opt.wrong .quiz-opt-key {
  border-color: #d95f5f;
  color: #ef8a8a;
}

.quiz-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.quiz-submit,
.quiz-next {
  padding: 8px 22px;
  border: 1px solid var(--gold);
  border-radius: 7px;
  background: transparent;
  color: var(--gold-soft);
  font-size: 13px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.quiz-submit:hover:not(:disabled),
.quiz-next:hover {
  background: var(--gold);
  color: #0e1118;
}
.quiz-submit:disabled {
  cursor: not-allowed;
  border-color: var(--hair-soft);
  color: var(--text-ghost);
}
.quiz-next.ghost {
  border-color: var(--hair);
  color: var(--text-mute);
  letter-spacing: 1px;
}
.quiz-next.ghost:hover {
  background: var(--surface-2);
  color: var(--gold-soft);
}

.quiz-feedback {
  margin-top: 14px;
  border: 1px solid var(--hair-soft);
  border-left: 3px solid var(--gold);
  border-radius: 7px;
  padding: 10px 12px;
  background: var(--surface-2);
}
.quiz-feedback-result {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #ef8a8a;
}
.quiz-feedback-result.ok {
  color: #5fd58d;
}
.quiz-feedback-explain {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-mute);
}
.quiz-feedback-explain b {
  color: var(--gold-soft);
}

/* 结算 / 通关卡 */
.quiz-endcard {
  border: 1px solid var(--hair-soft);
  border-radius: 12px;
  padding: 28px 22px;
  background: radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.12), transparent 70%), var(--surface-soft);
  text-align: center;
}
.quiz-end-title {
  font-family: var(--font-cal);
  font-size: 22px;
  letter-spacing: 4px;
  color: var(--gold-soft);
}
.quiz-end-sub {
  margin: 10px 0 20px;
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--text-mute);
}
.quiz-end-sub b {
  color: var(--gold-soft);
}
.quiz-summary-stats {
  display: flex;
  gap: 10px;
  margin: 18px 0;
}
.quiz-summary-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 6px;
  border: 1px solid var(--hair-soft);
  border-radius: 8px;
  background: var(--surface-soft);
}
.quiz-summary-num {
  font-family: var(--font-cal);
  font-size: 26px;
  color: var(--gold-soft);
}
.quiz-summary-label {
  margin-top: 4px;
  font-size: 10.5px;
  letter-spacing: 1px;
  color: var(--text-faint);
}
.quiz-end-btns {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 560px) {
  .quiz-opts {
    grid-template-columns: 1fr;
  }
  .quiz-progress-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .quiz-end-btns {
    flex-direction: column;
  }
  .quiz-item {
    min-height: 0;
  }
}
</style>
