<script setup>
import { computed } from 'vue'
import { CARDS, EQUIPS, SUITS, cardName } from '../../game/rules.js'

const props = defineProps({
  card: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
  faceDown: { type: Boolean, default: false }
})
defineEmits(['pick'])

const def = computed(() => CARDS[props.card.key] || EQUIPS[props.card.key] || {})
const kind = computed(() => (EQUIPS[props.card.key] ? 'equip' : def.value.kind || 'basic'))
const kindLabel = computed(() => (kind.value === 'equip' ? '军械' : kind.value === 'scheme' ? '计略' : '基础'))
const suit = computed(() => SUITS[props.card.suit] || { symbol: '', name: '', red: false })
</script>

<template>
  <button
    type="button"
    class="card"
    :class="[kind, { selected, disabled, small, red: suit.red }]"
    :disabled="disabled"
    :title="def.desc || ''"
    @click="$emit('pick', card)"
  >
    <template v-if="faceDown">
      <span class="back-mark">漢</span>
    </template>
    <template v-else>
      <span class="corner">{{ suit.symbol }}{{ card.num }}</span>
      <span class="name">{{ cardName(card.key) }}</span>
      <span class="kind">{{ kindLabel }}</span>
    </template>
  </button>
</template>

<style scoped>
.card {
  position: relative;
  width: 62px;
  height: 86px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 2px;
  border-radius: 8px;
  border: 1px solid var(--g-hair);
  background: linear-gradient(170deg, rgba(250, 245, 232, 0.96), rgba(238, 228, 205, 0.98));
  color: #2c2114;
  font-family: var(--font-cal, serif);
  cursor: pointer;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out),
    border-color 0.18s var(--ease-out);
  box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6);
}
.card:hover:not(:disabled) {
  transform: translateY(-6px);
  box-shadow: 0 12px 22px -10px rgba(0, 0, 0, 0.7);
}
.card.selected {
  transform: translateY(-8px);
  border-color: var(--g-gold);
  box-shadow: 0 0 0 1px var(--g-gold), 0 12px 24px -10px rgba(212, 175, 55, 0.6);
}
.card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.card.small {
  width: 46px;
  height: 64px;
}
.corner {
  position: absolute;
  top: 3px;
  left: 5px;
  font-size: 11px;
  opacity: 0.75;
}
.card.red .corner {
  color: #a33224;
}
.name {
  font-size: 20px;
  letter-spacing: 1px;
  line-height: 1.1;
}
.card.small .name {
  font-size: 15px;
}
.kind {
  font-size: 10px;
  opacity: 0.6;
  letter-spacing: 2px;
}
.back-mark {
  font-size: 22px;
  color: #7a1414;
  opacity: 0.8;
}
/* 卡牌色调 */
.card.basic {
  background: linear-gradient(170deg, #fbf6ea, #efe3c8);
}
.card.scheme {
  background: linear-gradient(170deg, #f4ecdf, #e4d3b4);
  border-color: rgba(154, 111, 30, 0.5);
}
.card.equip {
  background: linear-gradient(170deg, #eef1f3, #dde3e6);
}
</style>
