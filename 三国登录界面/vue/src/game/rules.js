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
/**
 * 武将技图鉴（典故驱动版）
 *
 * 一名武将可拥有多个技能，skills 数组即全部技能：
 *   effect   —— 引擎识别的结算 key（engine.js 实现，改文案不会破坏平衡）
 *   name/type/desc —— 展示文案，后台管理系统可覆盖主技文案
 *   allusion —— 历史典故出处，UI 以浮层展示
 *
 * 引擎约定：
 *   常策（锁定技）与应策（响应技）由引擎在对应时机自动结算，无需玩家操作；
 *   奇谋由玩家/AI 主动发动；秘计一局仅一次，走 game.useSecretSkill()。
 */
export const HERO_SKILLS = {
  /* ---------------- 汉室 ---------------- */
  刘备: {
    skills: [
      {
        effect: 'give_rende', name: '仁德', type: '奇谋',
        desc: '出牌阶段限一次：弃两张手牌交给一名其他角色，你回复 1 点体力。',
        allusion: '建安十三年曹操南征，刘备携民渡江，日行十余里而不弃百姓（《三国志·先主传》）；又三让徐州，以仁德立身。'
      },
      {
        effect: 'lord_support', name: '昭烈', type: '常策',
        desc: '锁定技：你的手牌上限 +2（众人拥戴，粮草不绝）。',
        allusion: '桃园结义、得人死力——关羽挂印封金、赵云长坂救主，皆因刘备能得众心。'
      }
    ]
  },
  关羽: {
    skills: [
      {
        effect: 'slash_any', name: '武圣', type: '应策',
        desc: '你可将任意一张手牌当作【击】使用；若该牌为红色，目标需两张【挡】才能抵消。',
        allusion: '建安五年白马之围，"羽望见良麾盖，策马刺良于万众之中，斩其首还，绍诸将莫能当者"（《三国志·关羽传》）。'
      },
      {
        effect: 'secret_unblockable', name: '单刀', type: '秘计',
        desc: '一局一次：弃一张手牌，对攻击范围内一名角色造成 1 点创伤，不可被【挡】抵消。',
        allusion: '建安二十年鲁肃索荆州，关羽单刀赴会，只带周仓与数骑赴吴营，词色慷慨，肃等慑服。'
      }
    ]
  },
  赵云: {
    skills: [
      {
        effect: 'slash_dodge_swap', name: '龙胆', type: '应策',
        desc: '你可将【击】当作【挡】使用，或将【挡】当作【击】使用。',
        allusion: '建安十三年长坂坡，赵云怀抱后主、保护甘夫人皆得免难；刘备赞曰"子龙一身都是胆也"（《云别传》）。'
      },
      {
        effect: 'secret_rescue', name: '单骑救主', type: '秘计',
        desc: '一局一次：弃置所有手牌，令一名其他角色回复 1 点体力并摸 2 张牌（若其已阵亡则不可用）。',
        allusion: '长坂坡单骑冲阵救出阿斗——弃全部身家，换一人活命。'
      }
    ]
  },
  诸葛亮: {
    skills: [
      {
        effect: 'kongcheng', name: '空城', type: '常策',
        desc: '锁定技：你没有手牌时，不能被【击】与【探囊】指定。',
        allusion: '街亭失守后，亮凭栏而坐、焚香操琴，司马懿疑有伏兵而退（本事见《三国志》裴松之注引"郭冲三事"）。'
      },
      {
        effect: 'star_gaze', name: '观星', type: '奇谋',
        desc: '出牌阶段限一次：弃一张手牌，摸一张牌，并察牌堆顶三张以知天时。',
        allusion: '"亮夜观天象"，借东风、草船借箭皆赖知天时；星象即牌堆——看得见的未来。'
      },
      {
        effect: 'secret_revive', name: '七星', type: '秘计',
        desc: '一局一次：体力不高于 1 点时，弃置所有牌，回复至 2 点体力并摸 2 张牌。',
        allusion: '建兴十二年五丈原，亮禳星祈寿，设七星灯祈禳延寿（演义第一〇三回）。'
      }
    ]
  },

  /* ---------------- 曹魏 ---------------- */
  曹操: {
    skills: [
      {
        effect: 'hurt_steal', name: '收编', type: '应策',
        desc: '你受到创伤后，获得伤害来源的一张手牌。',
        allusion: '初平三年破青州黄巾，"受降卒三十余万……收其精锐者，号为青州兵"（《三国志·武帝纪》）。'
      },
      {
        effect: 'ban_slash', name: '挟天子', type: '奇谋',
        desc: '出牌阶段限一次：弃一张手牌，令一名其他角色本回合不能使用【击】。',
        allusion: '建安元年，曹操迎汉献帝于洛阳，"挟天子以令诸侯"——不是打你，是不许你动手。'
      }
    ]
  },
  夏侯惇: {
    skills: [
      {
        effect: 'retaliate_choice', name: '拔矢啖睛', type: '应策',
        desc: '你受到【击】的创伤后，令伤害来源选择：弃两张手牌，或受到 1 点创伤。',
        allusion: '建安二年征吕布，惇为流矢所中伤左目，拔箭啖睛曰"父精母血，不可弃也"（《魏略》）。'
      },
      {
        effect: 'heal_boost', name: '刚烈', type: '常策',
        desc: '锁定技：你受到的【援】回复量 +1。',
        allusion: '惇性清俭刚烈，得赏赐辄分与将士——恢复力源自其悍勇与得众。'
      }
    ]
  },
  司马懿: {
    skills: [
      {
        effect: 'judge_swap', name: '鬼才', type: '应策',
        desc: '任意角色的判定牌生效前，你可打出一张手牌代替之（每回合限一次）。',
        allusion: '懿鹰视狼顾，善揣度人心、预判局势；亮送巾帼之服激其出战，懿笑问寝食，已知其命不久（《晋书·宣帝纪》）。'
      },
      {
        effect: 'secret_loot', name: '高平陵', type: '秘计',
        desc: '一局一次：一名角色阵亡时，你可尽取其手牌与装备，并回复 1 点体力。',
        allusion: '正始十年，懿趁曹爽陪帝谒高平陵，闭城门、据武库，一举夺权，尽收曹爽之众。'
      }
    ]
  },
  张辽: { effect: 'force_discard', name: '威震', type: '奇谋', desc: '出牌阶段，弃一张手牌，令一名角色弃置一张手牌' },
  许褚: { effect: 'slash_boost', name: '裸衣', type: '奇谋', desc: '弃一张手牌，本回合你的【击】创伤 +1' },
  郭嘉: { effect: 'hurt_draw2', name: '遗计', type: '应策', desc: '你受到创伤后，摸两张牌' },

  /* ---------------- 东吴 ---------------- */
  周瑜: {
    skills: [
      {
        effect: 'draw1', name: '英姿', type: '奇谋',
        desc: '出牌阶段限一次：你摸一张牌。',
        allusion: '"遥想公瑾当年，小乔初嫁了，雄姿英发，羽扇纶巾"——苏轼《念奴娇·赤壁怀古》。'
      },
      {
        effect: 'counter_steal', name: '反间', type: '应策',
        desc: '你成为【击】的目标并结算后，可弃一张手牌，令对方交给你一张手牌，否则其受 1 点创伤。',
        allusion: '赤壁战前，瑜利用蒋干盗书，使曹操疑杀水军都督蔡瑁、张允（《江表传》）。'
      },
      {
        effect: 'secret_aoe_fire', name: '火烧赤壁', type: '秘计',
        desc: '一局一次：弃一张红色手牌，对至多两名其他角色各造成 1 点不可被【挡】的创伤。',
        allusion: '建安十三年，黄盖诈降纵火，"顷之，烟炎张天，人马烧溺死者甚众"（《三国志·周瑜传》）。'
      }
    ]
  },
  孙尚香: {
    skills: [
      {
        effect: 'equip_lost_draw2', name: '枭姬', type: '应策',
        desc: '你失去装备区里的一张牌后，你摸两张牌。',
        allusion: '孙夫人"才捷刚猛，有诸兄之风"，侍婢百余人皆执刀侍立（《三国志·法正传》）。武备被夺，反而愈战愈勇。'
      },
      {
        effect: 'heal_ally', name: '联姻', type: '奇谋',
        desc: '出牌阶段限一次：弃两张手牌，令一名其他角色与你各回复 1 点体力。',
        allusion: '建安十四年，孙权嫁妹于刘备，孙刘联盟以抗曹（《三国志·先主传》）。'
      }
    ]
  },
  陆逊: {
    skills: [
      {
        effect: ['immune_steal', 'immune_duel', 'scheme_resist'], name: '谦冲', type: '常策',
        desc: '锁定技：你不能成为【探囊】【困局】【惑敌】的目标；你受到计略造成的创伤 -1。',
        allusion: '陆逊"意思深长，未有远近之议"，为人谦逊沉稳、不露锋芒——沉得住气，故不受激将、不为流言所动。'
      },
      {
        effect: 'secret_aoe_burn', name: '夷陵', type: '秘计',
        desc: '一局一次：弃置所有红色手牌，对至多三名其他角色各造成 1 点创伤，并各弃置一张装备。',
        allusion: '章武二年，逊以火攻破蜀军，"乃敕各持一把茅，以火攻拔之……破其四十余营"（《三国志·陆逊传》）。'
      }
    ]
  },
  吕蒙: { effect: 'no_discard', name: '克己', type: '常策', desc: '若本回合未使用过【击】，收兵阶段不必弃牌' },
  甘宁: { effect: 'black_steal', name: '奇袭', type: '奇谋', desc: '你可将一张黑色手牌当作【探囊】使用' },
  太史慈: { effect: 'slash_draw', name: '神射', type: '应策', desc: '你的【击】造成创伤后，你摸一张牌' },
  孙权: { effect: 'balance', name: '制衡', type: '奇谋', desc: '弃置任意数量手牌，再摸等量的牌（每回合限一次）' },

  /* ---------------- 群雄 ---------------- */
  吕布: {
    skills: [
      {
        effect: 'double_dodge', name: '无双', type: '应策',
        desc: '你使用的【击】需两张【挡】才能抵消。',
        allusion: '"人中吕布，马中赤兔"（《曹瞒传》）。布便弓马、膂力过人，号为飞将，寻常防御挡他不住。'
      },
      {
        effect: 'secret_aoe_force', name: '辕门射戟', type: '秘计',
        desc: '一局一次：弃一张【击】，令所有其他角色各弃一张手牌或受到 1 点创伤。',
        allusion: '建安元年，纪灵攻刘备，布于营门举弓射戟正中小支，诸将惊呼"将军天威也"，遂罢兵解斗。'
      }
    ]
  },
  貂蝉: {
    skills: [
      {
        effect: 'duel_two', name: '离间', type: '奇谋',
        desc: '出牌阶段限一次：弃一张牌，指定两名其他角色，令前者对后者出一张【击】，不出则失去 1 点体力。',
        allusion: '司徒王允设连环美人计，先许貂蝉于吕布，后献于董卓，使二人反目，终致吕布手刃董卓。'
      },
      {
        effect: 'end_draw', name: '闭月', type: '常策',
        desc: '锁定技：你的回合结束时，你摸一张牌。',
        allusion: '貂蝉有"闭月"之貌——月亮见其美貌，自愧不如，隐入云中。'
      }
    ]
  },
  华佗: {
    skills: [
      {
        effect: 'heal_skill', name: '青囊', type: '奇谋',
        desc: '出牌阶段限两次：弃一张手牌，令一名已受伤的角色回复 1 点体力。',
        allusion: '华佗"精方药……合汤不过数种"，创麻沸散、五禽戏（《三国志·方技传》）；《青囊书》为医家至宝。'
      },
      {
        effect: 'dying_heal_red', name: '刮骨', type: '应策',
        desc: '一名角色濒死时，你可将一张红色手牌当作【援】对其使用。',
        allusion: '关羽左臂中流矢，医曰"当破臂作创，刮骨去毒"，羽伸臂令医劈之，割炙引酒，言笑自若。'
      }
    ]
  },
  张飞: { effect: 'extra_slash', name: '咆哮', type: '奇谋', desc: '出牌阶段，你可额外使用一张【击】' },
  马超: { effect: 'reach_ignore', name: '铁骑', type: '常策', desc: '你计算攻击距离时无视目标的坚驹' },
  黄忠: { effect: 'reach_plus', name: '烈弓', type: '常策', desc: '你的攻击距离 +1' },
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

/**
 * 把英雄榜武将映射成游戏武将。
 *
 * 产出字段：
 *   hero.skills —— 全部技能（含常策/应策/奇谋/秘计），UI 图鉴与引擎共用
 *   hero.skill  —— 主技（第一个非秘计技能），老代码与后台文案覆盖都用它
 *   hero.secret —— 秘计（一局一次），没有则为 null
 */
export function toGameHero(raw) {
  const preset = HERO_SKILLS[raw.name]
  // 兼容两种写法：{ skills: [...] } 多技能 或 单技能扁平对象
  let list = preset && preset.skills ? preset.skills.slice() : null
  if (!list && preset) {
    list = [{ effect: preset.effect, name: preset.name, type: preset.type, desc: preset.desc, allusion: preset.allusion }]
  }
  if (!list || !list.length) {
    list = [{ effect: 'none', name: '—', type: '常策', desc: '暂无绝技', allusion: '' }]
  }
  // 后台改过文案就用后台的（只覆盖主技）
  if (raw.skillName) {
    list = list.map((s, i) => (i === 0 ? { ...s, name: raw.skillName, type: raw.skillType || s.type, desc: raw.skillDesc || s.desc } : s))
  }
  const skills = list.map((s) => ({
    effect: s.effect || 'none',
    name: s.name || '—',
    type: SKILL_TYPES[s.type] ? s.type : '常策',
    desc: s.desc || '',
    allusion: s.allusion || ''
  }))
  const mainIdx = Math.max(0, skills.findIndex((s) => s.type !== '秘计'))
  const secret = skills.find((s) => s.type === '秘计') || null
  const main = skills[mainIdx]

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
    skills,
    skill: main,
    secret
  }
}
