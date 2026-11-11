/**
 * 烽烟三国 · 会盟讨董 —— 模式层规则常量
 *
 * 只定义「模式专属」概念（兵种标签、战功悬赏、董卓事件、主将映射）。
 * 基础牌、牌名、花色、牌堆、武将池一律从 ../../rules.js 复用，
 * 不新增人设、不改 skill_text / desc / allusion。
 * 术语遵循 docs/规则真源与术语规范.md：【击】【挡】【援】【缓策】……
 */
import { EQUIPS, HERO_SKILLS } from '../../rules.js'

export const MODE = {
  id: 'huimeng',
  title: '会盟讨董',
  subtitle: '关东诸侯会盟，先积五战功者夺魁',
  winMerit: 5,
  handDraw: 2,
  startHand: 4,
  maxHand: 8,
  bountySlots: 3,
  seatMin: 2,
  seatMax: 5
}

/* ---------------- 兵种标签（模式映射，不改 CARDS 结构） ---------------- */

export const TROOPS = {
  cavalry: { key: 'cavalry', name: '骑兵', short: '骑', color: '#a33224', desc: '【击】' },
  infantry: { key: 'infantry', name: '步兵', short: '步', color: '#a8701a', desc: '【援】' },
  shield: { key: 'shield', name: '盾兵', short: '盾', color: '#2f6b8f', desc: '【挡】' },
  scheme: { key: 'scheme', name: '计谋', short: '谋', color: '#6b4c8a', desc: '所有计略牌' },
  equip: { key: 'equip', name: '军械', short: '械', color: '#5b7a5b', desc: '兵刃 / 甲胄 / 坐骑' }
}

/** 四元克制环：骑兵→步兵→盾兵→计谋→骑兵。闭环，杜绝无敌牌型 */
export const COUNTER = {
  cavalry: 'infantry',
  infantry: 'shield',
  shield: 'scheme',
  scheme: 'cavalry'
}

/** 返回能克制 troop 的兵种（化解事件用） */
export function counterOf(troop) {
  return Object.keys(COUNTER).find((k) => COUNTER[k] === troop) || null
}

const SCHEME_KEYS = ['negate', 'steal', 'draw2', 'duel', 'trapSlash', 'trapDraw', 'trapBolt']

/** 一张基础牌在本模式里充当什么兵种令；返回 null 表示不可用 */
export function troopOf(card) {
  if (!card) return null
  const k = card.key
  if (k === 'slash') return 'cavalry'
  if (k === 'heal') return 'infantry'
  if (k === 'dodge') return 'shield'
  if (SCHEME_KEYS.includes(k)) return 'scheme'
  if (EQUIPS[k]) return 'equip'
  return null
}

/* ---------------- 战功悬赏牌 ---------------- */

export const BOUNTY_TYPES = {
  slay: {
    key: 'slay', name: '斩敌', need: { cavalry: 2 }, bonus: 'none',
    flavor: '阵前斩将，最直截的战功'
  },
  cut: {
    key: 'cut', name: '断粮', need: { scheme: 1, infantry: 1 }, bonus: 'cut_leader',
    flavor: '断敌粮道；揭榜后令战功最高者弃一张手牌'
  },
  flag: {
    key: 'flag', name: '夺旗', need: { cavalry: 1, equip: 1 }, bonus: 'draw1',
    flavor: '夺其军旗；揭榜后自己额外摸一张牌'
  },
  rescue: {
    key: 'rescue', name: '救友', need: { infantry: 1, shield: 1 }, bonus: 'aid_lagger',
    flavor: '救友于危；揭榜后令战功最低者摸一张牌'
  }
}

/** 公共战功牌堆 20 张；gain 统一 1 点，差异放在 bonus 上 */
export const MERIT_RECIPE = [
  ['slay', 6],
  ['cut', 5],
  ['flag', 5],
  ['rescue', 4]
]

/* ---------------- 董卓事件牌 ----------------
 * weakness：董卓军以该兵种压境，弃 1 张「能克制它」的兵种令即可化解。
 * effect.type：
 *   discard_all / discard_leader  —— 弃牌（可被化解）
 *   claim_cost / draw_less / freeze_troop —— 下轮全局规则（不可化解）
 *   aid_lagger —— 追赶用正面事件
 */
export const DONG_EVENTS = [
  { key: 'burnLuoyang', name: '火烧洛阳', weakness: 'scheme', effect: { type: 'discard_all', n: 1 }, desc: '董卓焚毁洛阳，诸侯各弃 1 张手牌。' },
  { key: 'lvbu', name: '吕布出阵', weakness: 'cavalry', effect: { type: 'discard_leader', n: 2 }, desc: '飞将临阵，战功最高的诸侯弃 2 张手牌。' },
  { key: 'moveCapital', name: '迁都长安', weakness: 'infantry', effect: { type: 'claim_cost', n: 1 }, desc: '天子西迁，下轮所有揭榜须多付 1 张任意令。' },
  { key: 'scorched', name: '坚壁清野', weakness: 'cavalry', effect: { type: 'draw_less', n: 1 }, desc: '田野尽焚，下轮各诸侯少摸 1 张牌。' },
  { key: 'conscribe', name: '强征民夫', weakness: 'shield', effect: { type: 'discard_all', n: 1 }, desc: '西凉军强征，诸侯各弃 1 张手牌。' },
  { key: 'blockPass', name: '封锁虎牢', weakness: 'scheme', effect: { type: 'freeze_troop', troop: 'cavalry' }, desc: '虎牢关封锁，下轮骑兵令不可用于揭榜。' },
  { key: 'spy', name: '细作离间', weakness: 'scheme', effect: { type: 'discard_all', n: 1 }, desc: '细作散布流言，诸侯各弃 1 张手牌。' },
  { key: 'fireCamp', name: '夜袭营寨', weakness: 'shield', effect: { type: 'discard_leader', n: 1 }, desc: '西凉军夜袭，战功最高的诸侯弃 1 张手牌。' },
  { key: 'dongAnger', name: '董卓迁怒', weakness: 'infantry', effect: { type: 'discard_leader', n: 2 }, desc: '董卓迁怒于盟主，战功最高者弃 2 张手牌。' },
  { key: 'imperialEdict', name: '天子犒军', weakness: null, effect: { type: 'aid_lagger', n: 1 }, desc: '天子密诏犒军，战功最低的诸侯摸 1 张牌。' },
  { key: 'alliance', name: '联军会盟', weakness: null, effect: { type: 'aid_lagger', n: 2 }, desc: '诸侯重申盟约，战功最低者摸 2 张牌。' },
  { key: 'reward', name: '赏罚失序', weakness: null, effect: { type: 'aid_lagger', n: 1 }, desc: '战功簿错乱，落后的诸侯得 1 张补偿。' }
]

/* ---------------- 主将映射（mode_effects） ----------------
 * 26 名武将全部来自 rules.js 的 HERO_SKILLS，只加模式层效果键。
 * 不新增人设，不改技能名、描述、典故。
 */
export const MODE_EFFECTS = {
  /* 汉室 */
  刘备: { key: 'lagger_boost', name: '仁德', desc: '自己战功落后时揭榜额外 +1 战功（每局 2 次）' },
  关羽: { key: 'discount', name: '武圣', desc: '揭榜时可少付 1 张令（至少付 1 张）' },
  赵云: { key: 'block_immune', name: '龙胆', desc: '揭榜不受他家【挡】拦截' },
  诸葛亮: { key: 'peek', name: '观星', desc: '可见下一张董卓事件' },
  /* 曹魏 */
  曹操: { key: 'block_immune', name: '挟天子', desc: '揭榜不受他家【挡】拦截' },
  夏侯惇: { key: 'event_immune', name: '刚烈', desc: '免疫董卓事件的负面效果' },
  司马懿: { key: 'event_immune', name: '鬼才', desc: '免疫董卓事件的负面效果' },
  张辽: { key: 'discount', name: '威震', desc: '揭榜时可少付 1 张令（至少付 1 张）' },
  许褚: { key: 'discount', name: '裸衣', desc: '揭榜时可少付 1 张令（至少付 1 张）' },
  郭嘉: { key: 'peek', name: '遗计', desc: '可见下一张董卓事件' },
  /* 东吴 */
  周瑜: { key: 'scheme_wild', name: '英姿', desc: '自己的计谋令可当任意兵种使用' },
  孙尚香: { key: 'equip_wild', name: '枭姬', desc: '自己的军械令可当任意兵种使用' },
  陆逊: { key: 'event_immune', name: '谦冲', desc: '免疫董卓事件的负面效果' },
  吕蒙: { key: 'extra_draw', name: '克己', desc: '每回合多摸 1 张牌' },
  甘宁: { key: 'scheme_wild', name: '奇袭', desc: '自己的计谋令可当任意兵种使用' },
  太史慈: { key: 'aid_on_claim', name: '神射', desc: '每次揭榜后摸 1 张牌' },
  孙权: { key: 'extra_draw', name: '制衡', desc: '每回合多摸 1 张牌' },
  /* 群雄（注释分组，非阵营 key） */
  吕布: { key: 'block_immune', name: '无双', desc: '揭榜不受他家【挡】拦截' },
  貂蝉: { key: 'scheme_wild', name: '离间', desc: '自己的计谋令可当任意兵种使用' },
  华佗: { key: 'lagger_boost', name: '青囊', desc: '自己战功落后时揭榜额外 +1 战功（每局 2 次）' },
  张飞: { key: 'discount', name: '咆哮', desc: '揭榜时可少付 1 张令（至少付 1 张）' },
  马超: { key: 'equip_wild', name: '铁骑', desc: '自己的军械令可当任意兵种使用' },
  黄忠: { key: 'aid_on_claim', name: '烈弓', desc: '每次揭榜后摸 1 张牌' },
  董卓: { key: 'leader_guard', name: '暴虐', desc: '身为战功最高者时，被弃牌事件少弃 1 张' },
  袁绍: { key: 'lagger_boost', name: '乱击', desc: '自己战功落后时揭榜额外 +1 战功（每局 2 次）' },
  公孙瓒: { key: 'equip_wild', name: '白马', desc: '自己的军械令可当任意兵种使用' }
}

/** 武将池：直接取 rules.js 的 HERO_SKILLS，共 26 名 */
export const HERO_NAMES = Object.keys(HERO_SKILLS)

export const EFFECT_KEYS = {
  discount: '少付一令',
  block_immune: '不受拦截',
  event_immune: '免疫事件',
  extra_draw: '多摸一张',
  lagger_boost: '后进加功',
  peek: '预知事件',
  scheme_wild: '计谋百变',
  equip_wild: '军械百变',
  aid_on_claim: '揭榜补牌',
  leader_guard: '盟主自守'
}
