<script setup>
import { computed } from 'vue'
import { ROLES, EQUIPS, SKILL_TYPES, cardName } from '../../game/rules.js'
import { heroImg, onHeroImgError } from '../../composables/useHeroImg.js'

const props = defineProps({
  seat: { type: Object, required: true },
  current: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  isMe: { type: Boolean, default: false }
})
defineEmits(['pick'])

const role = computed(() => ROLES[props.seat.role] || { name: '?' })
const equips = computed(() =>
  Object.entries(props.seat.equip)
    .filter(([, v]) => v)
    .map(([slot, card]) => {
      const full = EQUIPS[card.key] ? EQUIPS[card.key].name : cardName(card.key)
      return {
        slot,
        // 只取前两字：四个槽位（兵刃/甲胄/两匹坐骑）也能排成一行，座位高度才稳定
        short: full.slice(0, 2),
        label: `${full}${EQUIPS[card.key] && EQUIPS[card.key].desc ? '：' + EQUIPS[card.key].desc : ''}`
      }
    })
)
const hpDots = computed(() => {
  const arr = []
  for (let i = 0; i < props.seat.maxHp; i++) arr.push(i < props.seat.hp)
  return arr
})
/** 全部技能：主技 + 其余技能（含秘计），悬停可看效果与典故 */
const skills = computed(() => {
  const h = props.seat.hero
  return (h.skills && h.skills.length ? h.skills : [h.skill]).filter((s) => s.name && s.name !== '—')
})
function skillTip(s) {
  let tip = s.desc || ''
  if (s.allusion) tip += `\n【典故】${s.allusion}`
  return tip
}
</script>

<template>
  <div
    class="seat"
    :class="{ current, selectable, dead: !seat.alive, me: isMe }"
    :style="{ '--fac': seat.hero.factionColor || '#8a7a5c' }"
    @click="$emit('pick', seat)"
  >
    <div class="badge-row">
      <span v-if="seat.roleOpen" class="role" :style="{ background: role.color }">{{ role.name }}</span>
      <span v-else class="role hidden">身份未明</span>
      <span v-if="isMe" class="you">你</span>
      <span v-if="!seat.alive" class="dead-tag">已殁</span>
    </div>

    <div class="top">
      <div class="por">
        <span class="por-fb" aria-hidden="true">{{ seat.hero.name.slice(0, 1) }}</span>
        <img
          :src="heroImg(seat.hero.name)"
          :alt="seat.hero.name"
          loading="lazy"
          decoding="async"
          draggable="false"
          @error="onHeroImgError"
        />
      </div>
      <div class="ident">
        <span class="h-name">{{ seat.hero.name }}</span>
        <span class="h-epithet">{{ seat.hero.epithet }}</span>
        <div class="faction">{{ seat.hero.factionName }}</div>
        <div class="hp" :title="`体力 ${seat.hp}/${seat.maxHp}`">
          <span v-for="(on, i) in hpDots" :key="i" class="dot" :class="{ on }"></span>
        </div>
      </div>
    </div>

    <div class="meta">
      <span class="hand" title="手牌数">✋ {{ seat.hand.length }}</span>
      <span v-if="seat.traps.length" class="trap" title="计略区">計 {{ seat.traps.length }}</span>
    </div>

    <!-- 装备格永远占位、且强制一行：网格布局里同一行座位共用行高，
         这一格若随装备增减变高，整排座位都会被顶动 -->
    <div class="equips">
      <span v-for="e in equips" :key="e.slot" class="eq" :title="e.label">{{ e.short }}</span>
    </div>

    <!-- 技能区：固定单行 + 省略号，无论 1 个还是 3 个技能高度都不变，
         避免高技能武将在矮屏把整排座位顶高（悬停可见完整效果/典故） -->
    <div class="skills">
      <span
        v-for="s in skills"
        :key="s.name"
        class="skill"
        :title="skillTip(s)"
      >
        <span class="s-type" :style="{ background: (SKILL_TYPES[s.type] && SKILL_TYPES[s.type].color) + '22', color: SKILL_TYPES[s.type] ? SKILL_TYPES[s.type].color : 'var(--g-gold)' }">{{ s.type }}</span><span class="s-name">{{ s.name }}</span>
      </span>
      <span v-if="!skills.length" class="skill empty">—</span>
    </div>
  </div>
</template>

<style scoped>
.seat {
  width: 158px;
  padding: 8px 9px;
  border-radius: 10px;
  border: 1px solid var(--g-hair);
  background: var(--g-panel);
  color: var(--g-text);
  font-size: 12px;
  line-height: 1.5;
  cursor: default;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out),
    border-color 0.18s var(--ease-out), opacity 0.3s var(--ease-out);
  box-shadow: 0 10px 26px -18px #000;
}
.seat.me {
  width: 176px;
}
.seat.current {
  border-color: var(--g-gold);
  box-shadow: 0 0 0 1px var(--g-gold), 0 14px 30px -16px rgba(212, 175, 55, 0.55);
}
.seat.selectable {
  cursor: pointer;
  border-color: #4ea36b;
  box-shadow: 0 0 0 1px #4ea36b, 0 14px 30px -16px rgba(78, 163, 107, 0.6);
  animation: pulse 1.4s infinite;
}
.seat.selectable:hover {
  transform: translateY(-3px) scale(1.03);
}
.seat.dead {
  opacity: 0.4;
  filter: grayscale(0.7);
}
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 1px #4ea36b, 0 14px 30px -16px rgba(78, 163, 107, 0.5);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(78, 163, 107, 0.35), 0 14px 30px -16px rgba(78, 163, 107, 0.8);
  }
}
.badge-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  min-height: 19px;
  overflow: hidden;
}
.role {
  padding: 1px 6px;
  border-radius: 999px;
  color: #fff8e6;
  font-size: 11px;
  letter-spacing: 1px;
}
.role.hidden {
  background: rgba(255, 255, 255, 0.08);
  color: var(--g-dim);
}
.you {
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid var(--g-gold);
  color: var(--g-gold);
  font-size: 10px;
}
.dead-tag {
  margin-left: auto;
  font-size: 10px;
  color: var(--g-faint);
}

/* 头像 + 名号：固定高度，牌局进行中座位不会忽高忽低 */
.top {
  display: flex;
  align-items: stretch;
  gap: 7px;
  height: 66px;
}
.por {
  position: relative;
  flex: none;
  width: 50px;
  height: 66px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--g-hair);
  background: #1b1409;
}
.por img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
  display: block;
}
/* 缺图兜底：姓氏大字，不出现破图 */
.por-fb {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-cal, serif);
  font-size: 26px;
  color: var(--fac);
  opacity: 0.7;
  background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.4));
}
.ident {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  gap: 1px;
}
.h-name {
  font-family: var(--font-cal, serif);
  font-size: 16px;
  color: var(--g-text);
  white-space: nowrap;
}
.h-epithet {
  font-size: 10px;
  color: var(--g-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.faction {
  font-size: 11px;
  color: var(--fac);
  opacity: 0.9;
}
.hp {
  display: flex;
  gap: 3px;
  margin-top: 3px;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.5);
  background: rgba(255, 255, 255, 0.06);
}
.dot.on {
  background: radial-gradient(circle at 35% 30%, #e8c86a, #b22222);
  border-color: #b22222;
}
.meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  color: var(--g-dim);
  font-size: 11px;
}
.trap {
  color: #d98b3a;
}
.equips {
  display: flex;
  flex-wrap: nowrap;
  gap: 3px;
  margin-top: 3px;
  /* 固定一行高：不装军械时也占位，座位高度才不会变 */
  height: 17px;
  overflow: hidden;
}
.eq {
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(120, 160, 200, 0.14);
  color: #9dc0dd;
  font-size: 10px;
}
.skills {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--g-hair);
  font-size: 11px;
  /* 固定单行高：技能数量变化不改变座位高度 */
  height: 17px;
  overflow: hidden;
}
.skill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: help;
  white-space: nowrap;
  flex: none;
  min-width: 0;
}
.skill .s-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.skill.empty {
  color: var(--g-faint);
}
.s-type {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(212, 175, 55, 0.14);
  color: var(--g-gold);
  font-size: 10px;
  flex: none;
}
.s-name {
  color: var(--g-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 矮屏（1366×768 笔记本 / 1280×800）压一档座位尺寸：
   牌桌高度只有 450~510px，上下两排座位必须各自瘦身才放得下 */
@media (max-height: 860px) {
  .seat {
    width: 148px;
    padding: 5px 8px;
  }
  .seat.me {
    width: 164px;
  }
  .badge-row {
    min-height: 17px;
    margin-bottom: 3px;
  }
  .top {
    height: 52px;
    gap: 6px;
  }
  .por {
    width: 40px;
    height: 52px;
  }
  .h-name {
    font-size: 15px;
  }
  .h-epithet {
    display: none;
  }
  .hp {
    margin-top: 2px;
  }
  .meta {
    margin-top: 2px;
  }
  .equips {
    margin-top: 2px;
  }
  .skills {
    margin-top: 2px;
    padding-top: 2px;
    gap: 3px;
    height: 16px;
  }
}
@media (max-height: 740px) {
  .h-name {
    font-size: 14px;
  }
  .dot {
    width: 8px;
    height: 8px;
  }
  .faction {
    font-size: 10px;
  }
}
</style>
