/**
 * 烽烟三国杀 · 规则常量与卡牌定义
 *
 * 这里是纯数据层：身份、势力、卡牌、军械、判定规则、武将技图鉴。
 * 引擎（engine.js）只依赖本文件暴露的 key，改数值不必动逻辑。
 */

/* ==================== 势力 ==================== */

export const FACTIONS = {
  han: { key: 'han', name: '汉室', color: '#9c3a2f' },
  wei: { key: 'wei', name: '曹魏', color: '#3a5f7d' },
  shu: { key: 'shu', name: '蜀汉', color: '#a8701a' },
  wu: { key: 'wu', name: '东吴', color: '#2f6b4f' }
}

export function factionName(key) {
  return FACTIONS[key] ? FACTIONS[key].name : '群雄'
}

export function factionColor(key) {
  return FACTIONS[key] ? FACTIONS[key].color : '#8a7a5c'
}

/* ==================== 身份 ==================== */

export const ROLES = {
  lord: {
    key: 'lord',
    name: '汉主',
    color: '#b8860b',
    open: true,
    goal: '清剿全部群雄与隐客',
    desc: '开局明置，天下共知'
  },
  loyal: {
    key: 'loyal',
    name: '忠良',
    color: '#2f6b8f',
    open: false,
    goal: '护住汉主，清剿群雄与隐客',
    desc: '与汉主同胜'
  },
  rebel: {
    key: 'rebel',
    name: '群雄',
    color: '#a33224',
    open: false,
    goal: '击杀汉主，倾覆汉室',
    desc: '汉主阵亡即胜'
  },
  spy: {
    key: 'spy',
    name: '隐客',
    color: '#6b4c8a',
    open: false,
    goal: '清掉忠良与群雄，最后单挑汉主取胜',
    desc: '汉主提前阵亡则前功尽弃'
  }
}

/** 座位人数 → 身份配比 */
export const ROLE_SETUP = {
  5: ['lord', 'loyal', 'rebel', 'rebel', 'spy'],
  8: ['lord', 'loyal', 'loyal', 'rebel', 'rebel', 'rebel', 'rebel', 'spy']
}

export function roleName(key) {
  return ROLES[key] ? ROLES[key].name : '未知'
}

/* ==================== 卡牌 ==================== */

export const SUITS = {
  spade: { key: 'spade', name: '黑桃', symbol: '♠', color: '#2b2b2b', red: false },
  heart: { key: 'heart', name: '红桃', symbol: '♥', color: '#a33224', red: true },
  club: { key: 'club', name: '梅花', symbol: '♣', color: '#2b2b2b', red: false },
  diamond: { key: 'diamond', name: '方块', symbol: '♦', color: '#a33224', red: true }
}

export const CARD_KIND = { basic: '基础', scheme: '计略', equip: '军械' }

/**
 * 卡牌定义。
 * target: 'none' 无需目标 / 'enemy' 需选目标（受距离限制）/ 'any' 需选目标（不限距离）/ 'self'
 * delay:  是否为延时计略（进目标计略区）
 */
export const CARDS = {
  slash: {
    key: 'slash', name: '击', kind: 'basic', target: 'enemy',
    desc: '指定攻击范围内一名角色，对方不出【挡】则受 1 点创伤。用兵阶段常规限用一张。'
  },
  dodge: {
    key: 'dodge', name: '挡', kind: 'basic', target: 'none',
    desc: '抵消一次【击】。只能在被【击】时打出。'
  },
  heal: {
    key: 'heal', name: '援', kind: 'basic', target: 'any',
    desc: '令一名角色回复 1 点体力；也可在自己回合对自己使用。濒死时可救人性命。'
  },
  negate: {
    key: 'negate', name: '缓策', kind: 'scheme', target: 'none',
    desc: '抵消一张计略的效果。可在计略结算前打出。'
  },
  steal: {
    key: 'steal', name: '探囊', kind: 'scheme', target: 'enemy',
    desc: '夺取距离 1 以内一名角色的一张手牌或装备。'
  },
  draw2: {
    key: 'draw2', name: '广纳', kind: 'scheme', target: 'self',
    desc: '自己摸两张牌。'
  },
  duel: {
    key: 'duel', name: '惑敌', kind: 'scheme', target: 'enemy',
    desc: '与一名角色对决：双方轮流出【击】，不出者受 1 点创伤。'
  },
  trapSlash: {
    key: 'trapSlash', name: '困局', kind: 'scheme', target: 'any', delay: true,
    desc: '延时计略。判定非红桃则生效：其出牌阶段不能使用【击】。'
  },
  trapDraw: {
    key: 'trapDraw', name: '断粮', kind: 'scheme', target: 'any', delay: true,
    desc: '延时计略。判定非红桃则生效：其征粮阶段不能摸牌。'
  },
  trapBolt: {
    key: 'trapBolt', name: '惊雷', kind: 'scheme', target: 'any', delay: true,
    desc: '延时计略。判定为黑桃 2-9 则受 2 点创伤，否则传给下家。'
  }
}

/* ---------------- 军械 ---------------- */

export const EQUIP_SLOTS = {
  weapon: { key: 'weapon', name: '兵刃' },
  armor: { key: 'armor', name: '甲胄' },
  minusHorse: { key: 'minusHorse', name: '奔驹' },
  plusHorse: { key: 'plusHorse', name: '坚驹' }
}

/** 军械一览：reach 为装备后提供的攻击距离，distMinus / distPlus 影响距离计算 */
export const EQUIPS = {
  blade1: { key: 'blade1', name: '青釭剑', slot: 'weapon', reach: 2, desc: '攻击距离 2' },
  blade2: { key: 'blade2', name: '倚天剑', slot: 'weapon', reach: 3, desc: '攻击距离 3' },
  blade3: { key: 'blade3', name: '丈八蛇矛', slot: 'weapon', reach: 4, desc: '攻击距离 4' },
  blade4: { key: 'blade4', name: '方天画戟', slot: 'weapon', reach: 5, desc: '攻击距离 5' },
  armor1: { key: 'armor1', name: '连环甲', slot: 'armor', desc: '受到【击】时，可弃一张手牌免除创伤' },
  armor2: { key: 'armor2', name: '藤甲', slot: 'armor', desc: '受到创伤时，若来源无兵刃则创伤 -1' },
  minus1: { key: 'minus1', name: '的卢', slot: 'minusHorse', distMinus: 1, desc: '你计算与他人距离 -1' },
  plus1: { key: 'plus1', name: '绝影', slot: 'plusHorse', distPlus: 1, desc: '他人计算与你距离 +1' }
}

/* ---------------- 牌堆配比 ---------------- */

const RECIPE = [
  ['slash', 30],
  ['dodge', 15],
  ['heal', 8],
  ['negate', 4],
  ['steal', 5],
  ['draw2', 5],
  ['duel', 3],
  ['trapSlash', 3],
  ['trapDraw', 2],
  ['trapBolt', 2],
  ['blade1', 2], ['blade2', 2], ['blade3', 1], ['blade4', 1],
  ['armor1', 2], ['armor2', 1],
  ['minus1', 3], ['plus1', 3]
]

const SUIT_KEYS = Object.keys(SUITS)

let cardSeq = 0

/** 生成一副牌（含花色点数，判定阶段要用） */
export function buildDeck() {
  const deck = []
  for (const [key, count] of RECIPE) {
    for (let i = 0; i < count; i++) {
      const suit = SUIT_KEYS[Math.floor(Math.random() * SUIT_KEYS.length)]
      deck.push({
        uid: 'c' + ++cardSeq,
        key,
        suit,
        num: 1 + Math.floor(Math.random() * 13)
      })
    }
  }
  return shuffle(deck)
}

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 卡牌展示名（军械不在 CARDS 里） */
export function cardName(key) {
  return CARDS[key] ? CARDS[key].name : EQUIPS[key] ? EQUIPS[key].name : key
}

export function cardDesc(key) {
  return CARDS[key] ? CARDS[key].desc : EQUIPS[key] ? EQUIPS[key].desc : ''
}

export function isEquip(key) {
  return !!EQUIPS[key]
}

export function isDelay(key) {
  return !!(CARDS[key] && CARDS[key].delay)
}

/* ==================== 判定规则 ==================== */

/**
 * 判定一张牌的结果。
 * trapSlash / trapDraw：红桃为吉，免除；否则生效
 * trapBolt：黑桃 2-9 触发，否则传给下家
 */
export function judgeResult(trapKey, card) {
  if (trapKey === 'trapBolt') {
    return card.suit === 'spade' && card.num >= 2 && card.num <= 9
  }
  return card.suit !== 'heart'
}

export function suitSymbol(suit) {
  return SUITS[suit] ? SUITS[suit].symbol : ''
}

export function isRedCard(card) {
  return !!(SUITS[card.suit] && SUITS[card.suit].red)
}

/* ==================== 武将技图鉴 ==================== */

/**
 * 技能按武将姓名匹配（英雄榜数据是稳定的）。
 * 后台管理系统可以改技能名与描述文案，但效果由 effect 决定，避免改文案破坏平衡。
 * effect 的实现见 engine.js 的 SKILL_HOOKS。
 */
export const HERO_SKILLS = {
  曹操: { effect: 'steal_card', name: '挟主', type: '奇谋', desc: '出牌阶段，弃一张手牌，令一名其他角色交出一张手牌' },
  夏侯惇: { effect: 'retaliate', name: '刚烈', type: '应策', desc: '你受到创伤后，对伤害来源造成 1 点创伤' },
  张辽: { effect: 'force_discard', name: '威震', type: '奇谋', desc: '出牌阶段，弃一张手牌，令一名角色弃置一张手牌' },
  许褚: { effect: 'slash_boost', name: '裸衣', type: '奇谋', desc: '弃一张手牌，本回合你的【击】创伤 +1' },
  司马懿: { effect: 'hurt_steal', name: '反馈', type: '应策', desc: '你受到创伤后，获得伤害来源的一张手牌' },
  郭嘉: { effect: 'hurt_draw2', name: '遗计', type: '应策', desc: '你受到创伤后，摸两张牌' },
  关羽: { effect: 'slash_any', name: '武圣', type: '应策', desc: '你可将任意一张手牌当作【击】使用' },
  张飞: { effect: 'extra_slash', name: '咆哮', type: '奇谋', desc: '出牌阶段，你可额外使用一张【击】' },
  赵云: { effect: 'slash_dodge_swap', name: '龙胆', type: '应策', desc: '你可将【挡】当【击】、【击】当【挡】使用' },
  马超: { effect: 'reach_ignore', name: '铁骑', type: '常策', desc: '你计算攻击距离时无视目标的坚驹' },
  黄忠: { effect: 'reach_plus', name: '烈弓', type: '常策', desc: '你的攻击距离 +1' },
  诸葛亮: { effect: 'kongcheng', name: '空城', type: '常策', desc: '你没有手牌时，不能被【击】与【探囊】指定' },
  周瑜: { effect: 'draw1', name: '英姿', type: '奇谋', desc: '出牌阶段，你可摸一张牌（每回合限一次）' },
  吕蒙: { effect: 'no_discard', name: '克己', type: '常策', desc: '若本回合未使用过【击】，收兵阶段不必弃牌' },
  陆逊: { effect: 'immune_steal', name: '谦逊', type: '常策', desc: '你不能成为【探囊】与【困局】的目标' },
  甘宁: { effect: 'black_steal', name: '奇袭', type: '奇谋', desc: '你可将一张黑色手牌当作【探囊】使用' },
  太史慈: { effect: 'slash_draw', name: '神射', type: '应策', desc: '你的【击】造成创伤后，你摸一张牌' },
  孙权: { effect: 'balance', name: '制衡', type: '奇谋', desc: '弃置任意数量手牌，再摸等量的牌（每回合限一次）' },
  吕布: { effect: 'double_dodge', name: '无双', type: '应策', desc: '你的【击】需两张【挡】才能抵消' },
  董卓: { effect: 'hurt_draw1', name: '暴虐', type: '应策', desc: '你受到创伤后，摸一张牌' },
  袁绍: { effect: 'aoe_damage', name: '乱击', type: '秘计', desc: '一局一次：弃两张手牌，对场上其他角色各造成 1 点创伤' },
  公孙瓒: { effect: 'dist_minus', name: '白马', type: '常策', desc: '你计算与其他角色的距离 -1' }
}

/** 技能类型配色与说明 */
export const SKILL_TYPES = {
  常策: { name: '常策', color: '#5b7a5b', hint: '锁定技，永久生效' },
  奇谋: { name: '奇谋', color: '#a8701a', hint: '主动技，自己回合发动' },
  应策: { name: '应策', color: '#2f6b8f', hint: '响应技，满足条件触发' },
  秘计: { name: '秘计', color: '#6b4c8a', hint: '限定技，一局仅一次' }
}

/** 默认体力：军师偏脆，猛将偏厚；英雄榜若配了 hp 则以库里为准 */
export function defaultHp(hero) {
  if (hero.hp) return hero.hp
  if (hero.type === '军师') return 3
  if (hero.type === '君主') return 4
  return (hero.power || 70) >= 92 ? 4 : 3
}

/** 把英雄榜武将映射成游戏武将 */
export function toGameHero(raw) {
  const preset = HERO_SKILLS[raw.name]
  return {
    id: raw.id,
    name: raw.name,
    epithet: raw.epithet || '',
    faction: raw.faction || 'han',
    factionName: factionName(raw.faction),
    factionColor: factionColor(raw.faction),
    type: raw.type || '',
    power: raw.power || 0,
    leadership: raw.leadership || 0,
    desc: raw.description || '',
    hp: defaultHp(raw),
    // 后台改过文案就用后台的，否则用图鉴
    skill: {
      effect: preset ? preset.effect : 'none',
      name: (raw.skillName || (preset && preset.name) || '—'),
      type: raw.skillType || (preset && preset.type) || '常策',
      desc: raw.skillDesc || (preset && preset.desc) || '暂无绝技'
    }
  }
}
