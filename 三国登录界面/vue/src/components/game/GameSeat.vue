<script setup>
import { computed } from 'vue'
import { ROLES, EQUIPS, SKILL_TYPES, cardName } from '../../game/rules.js'

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
    .map(([slot, card]) => ({ slot, name: cardName(card.key), label: EQUIPS[card.key] ? EQUIPS[card.key].name : '' }))
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

    <div class="hero">
      <span class="h-name">{{ seat.hero.name }}</span>
      <span class="h-epithet">{{ seat.hero.epithet }}</span>
    </div>

    <div class="faction" :style="{ color: 'var(--fac)' }">{{ seat.hero.factionName }}</div>

    <div class="hp" :title="`体力 ${seat.hp}/${seat.maxHp}`">
      <span v-for="(on, i) in hpDots" :key="i" class="dot" :class="{ on }"></span>
    </div>

    <div class="meta">
      <span class="hand" title="手牌数">✋ {{ seat.hand.length }}</span>
      <span v-if="seat.traps.length" class="trap" title="计略区">計 {{ seat.traps.length }}</span>
    </div>

    <div v-if="equips.length" class="equips">
      <span v-for="e in equips" :key="e.slot" class="eq" :title="e.label">{{ e.name }}</span>
    </div>

    <div v-if="skills.length" class="skills">
      <div
        v-for="s in skills"
        :key="s.name"
        class="skill"
        :title="skillTip(s)"
      >
        <span class="s-type" :style="{ background: (SKILL_TYPES[s.type] && SKILL_TYPES[s.type].color) + '22', color: SKILL_TYPES[s.type] ? SKILL_TYPES[s.type].color : 'var(--g-gold)' }">{{ s.type }}</span>
        <span class="s-name">{{ s.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seat {
  width: 132px;
  padding: 8px 10px;
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
  width: 152px;
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
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
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
.hero {
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.h-name {
  font-family: var(--font-cal, serif);
  font-size: 16px;
  color: var(--g-text);
}
.h-epithet {
  font-size: 10px;
  color: var(--g-faint);
}
.faction {
  font-size: 11px;
  opacity: 0.9;
}
.hp {
  display: flex;
  gap: 3px;
  margin: 4px 0;
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
  color: var(--g-dim);
  font-size: 11px;
}
.trap {
  color: #d98b3a;
}
.equips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 3px;
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
  flex-direction: column;
  gap: 2px;
  margin-top: 5px;
  padding-top: 4px;
  border-top: 1px dashed var(--g-hair);
  font-size: 11px;
}
.skill {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}
.s-type {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(212, 175, 55, 0.14);
  color: var(--g-gold);
  font-size: 10px;
}
.s-name {
  color: var(--g-dim);
}
</style>
