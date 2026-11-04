<script setup>
/**
 * 武将详情弹窗
 * 点击武将图鉴卡片弹出：大图立绘 + 全部技能（常策/奇谋/应策/秘计，含典故出处）。
 * 技能数据复用 game/rules.js 的 toGameHero（与游戏引擎同一份 HERO_SKILLS，
 * 同时保留后台管理系统覆盖的主技文案），保证图鉴与实战看到的技能一致。
 */
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { toGameHero, SKILL_TYPES, factionName } from '../game/rules.js'
import { heroFullImg, onHeroImgError } from '../composables/useHeroImg'

const props = defineProps({
  hero: { type: Object, default: null } // 图鉴行数据（含 skillName 等后台覆盖字段）
})
const emit = defineEmits(['close'])

const detail = computed(() => (props.hero ? toGameHero(props.hero) : null))
const skills = computed(() => (detail.value ? detail.value.skills : []))

/* 兵种/势力徽记配色与图鉴卡片一致 */
function skillStyle(s) {
  const t = SKILL_TYPES[s.type]
  return { '--sk-color': t ? t.color : '#8a7a5c' }
}

function skillHint(s) {
  const t = SKILL_TYPES[s.type]
  return t ? t.hint : ''
}

/* Esc 关闭 + 弹窗打开时禁止背景滚动 */
function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <transition name="hd-fade">
    <div v-if="hero" class="hd-mask" @click.self="emit('close')">
      <div class="hd-modal" role="dialog" aria-modal="true">
        <button type="button" class="hd-close" aria-label="关闭" @click="emit('close')">×</button>

        <div v-if="detail" class="hd-body">
          <!-- 左：大图立绘 -->
          <div class="hd-portrait" :data-f="detail.faction">
            <img
              class="hd-img"
              :src="heroFullImg(detail.name)"
              :alt="detail.name"
              decoding="async"
              @error="onHeroImgError"
            />
            <span class="hd-fallback-name" aria-hidden="true">{{ detail.name }}</span>
            <div class="hd-caption">
              <b>{{ detail.name }}</b>
              <i>{{ detail.epithet }}</i>
            </div>
          </div>

          <!-- 右：文字与技能 -->
          <div class="hd-info">
            <div class="hd-title">
              <span class="hd-fac">{{ factionName(detail.faction) }}</span>
              <span v-if="detail.type" class="hd-type">{{ detail.type }}</span>
              <span v-if="detail.power" class="hd-stat">武力 {{ detail.power }}</span>
              <span v-if="detail.leadership" class="hd-stat">统率 {{ detail.leadership }}</span>
              <span class="hd-stat">体力 {{ detail.hp }}</span>
            </div>

            <p class="hd-desc">{{ detail.desc || '暂无生平记载。' }}</p>

            <div class="hd-skills-head">武将技 <i>共 {{ skills.length }} 技</i></div>
            <div class="hd-skills">
              <div
                v-for="(s, idx) in skills"
                :key="idx"
                class="hd-skill"
                :style="skillStyle(s)"
              >
                <div class="hd-skill-top">
                  <span class="hd-skill-name">{{ s.name }}</span>
                  <span class="hd-skill-type">{{ s.type }}</span>
                </div>
                <p class="hd-skill-desc">{{ s.desc }}</p>
                <p v-if="s.allusion" class="hd-skill-allusion">{{ s.allusion }}</p>
                <p v-if="skillHint(s)" class="hd-skill-hint">{{ skillHint(s) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* 遮罩与入场 */
.hd-mask {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 18, 0.78);
  backdrop-filter: blur(5px);
  padding: 24px;
}
.hd-modal {
  position: relative;
  width: min(960px, 94vw);
  max-height: 88vh;
  overflow-y: auto;
  border: 1px solid var(--gold);
  border-radius: 16px;
  background: linear-gradient(180deg, #1a1d26, #10131a);
  box-shadow: 0 24px 70px -20px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(212, 175, 55, 0.12);
}
.hd-close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 5;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-mute);
  font-size: 26px;
  line-height: 1;
  padding: 0 4px;
}
.hd-close:hover {
  color: var(--gold-soft);
}

.hd-body {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 0;
  min-height: 420px;
}

/* 左侧立绘 */
.hd-portrait {
  position: relative;
  min-height: 320px;
  overflow: hidden;
  border-right: 1px solid var(--hair-soft);
  border-radius: 16px 0 0 16px;
  background: radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.1), transparent 70%);
}
.hd-portrait[data-f='wei'] { background: radial-gradient(circle at 50% 30%, rgba(58, 95, 125, 0.35), transparent 70%); }
.hd-portrait[data-f='shu'] { background: radial-gradient(circle at 50% 30%, rgba(168, 112, 26, 0.35), transparent 70%); }
.hd-portrait[data-f='wu']  { background: radial-gradient(circle at 50% 30%, rgba(47, 107, 79, 0.35), transparent 70%); }
.hd-portrait[data-f='han'] { background: radial-gradient(circle at 50% 30%, rgba(156, 58, 47, 0.35), transparent 70%); }

.hd-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.hd-fallback-name {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-cal, serif);
  font-size: 72px;
  letter-spacing: 12px;
  color: rgba(232, 200, 106, 0.22);
}
.hd-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 14px 16px 12px;
  background: linear-gradient(180deg, transparent, rgba(8, 9, 13, 0.88));
}
.hd-caption b {
  font-family: var(--font-cal, serif);
  font-size: 26px;
  letter-spacing: 6px;
  color: #fff4d8;
}
.hd-caption i {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--gold-soft);
}

/* 右侧信息 */
.hd-info {
  padding: 20px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hd-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.hd-fac {
  font-size: 12px;
  letter-spacing: 2px;
  color: #0e1118;
  background: var(--gold-soft);
  border-radius: 4px;
  padding: 2px 8px;
  font-weight: 700;
}
.hd-type,
.hd-stat {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-mute);
  border: 1px solid var(--hair-soft);
  border-radius: 4px;
  padding: 2px 8px;
}
.hd-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  color: var(--text-mute);
}
.hd-skills-head {
  font-family: var(--font-cal, serif);
  font-size: 15px;
  letter-spacing: 4px;
  color: var(--gold-soft);
  border-bottom: 1px solid var(--hair-soft);
  padding-bottom: 8px;
}
.hd-skills-head i {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-mute);
  margin-left: 8px;
  font-style: normal;
}
.hd-skills {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hd-skill {
  border: 1px solid var(--hair-soft);
  border-left: 3px solid var(--sk-color);
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
}
.hd-skill-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.hd-skill-name {
  font-family: var(--font-cal, serif);
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--sk-color);
  font-weight: 700;
}
.hd-skill-type {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--sk-color);
  border: 1px solid var(--sk-color);
  border-radius: 3px;
  padding: 1px 6px;
  opacity: 0.85;
}
.hd-skill-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text);
}
.hd-skill-allusion {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--text-mute);
  padding-left: 8px;
  border-left: 1px dashed var(--hair-soft);
}
.hd-skill-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-mute);
  opacity: 0.7;
}

/* 过渡 */
.hd-fade-enter-active,
.hd-fade-leave-active {
  transition: opacity 0.18s ease;
}
.hd-fade-enter-from,
.hd-fade-leave-to {
  opacity: 0;
}

/* 移动端：上下堆叠 */
@media (max-width: 760px) {
  .hd-body {
    grid-template-columns: 1fr;
  }
  .hd-portrait {
    min-height: 240px;
    max-height: 320px;
    border-right: none;
    border-bottom: 1px solid var(--hair-soft);
    border-radius: 16px 16px 0 0;
  }
  .hd-fallback-name {
    font-size: 52px;
  }
}

/* ========== 亮色主题覆盖（非 scoped 规则放这里由 build 处理） ========== */
</style>

<style>
/* 亮色主题：手动前缀，不用 :global（scoped + :global 后半段会被编译器丢弃，见 PROJECT_NOTES 大坑） */
html[data-theme='light'] .hd-modal {
  background: linear-gradient(180deg, #f6efdd, #efe4cd);
  border-color: #b58b2a;
  box-shadow: 0 24px 70px -20px rgba(60, 42, 10, 0.4);
}
html[data-theme='light'] .hd-close:hover {
  color: #8a6414;
}
html[data-theme='light'] .hd-caption b {
  color: #2b2010;
}
html[data-theme='light'] .hd-caption i {
  color: #7a5c1c;
}
html[data-theme='light'] .hd-fac {
  color: #fff8e6;
}
html[data-theme='light'] .hd-type,
html[data-theme='light'] .hd-stat {
  color: #6d5c3c;
  border-color: #d8c9a4;
}
html[data-theme='light'] .hd-desc {
  color: #5c4f36;
}
html[data-theme='light'] .hd-skills-head {
  color: #8a6414;
  border-color: #d8c9a4;
}
html[data-theme='light'] .hd-skill {
  border-color: #d8c9a4;
  background: rgba(120, 90, 30, 0.04);
}
html[data-theme='light'] .hd-skill-desc {
  color: #3c3428;
}
html[data-theme='light'] .hd-skill-allusion {
  color: #7a6a4c;
  border-color: #d8c9a4;
}
</style>
