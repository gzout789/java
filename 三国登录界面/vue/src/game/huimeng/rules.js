/**
 * 《烽烟三国·会盟讨董》规则数据 v1.0
 * 依据资料库蓝图《烽烟三国 · 五模式统一架构与首发细化》第 2 章。
 *
 * 命名约定（与身份杀引擎对齐）：蓝图的【斩/避/疗】在本模式统一为【击/挡/援】。
 * 所有牌均为手牌资源：不绑定座位距离、不绑定身份、不造成出局。
 */

/* ==================== 牌堆 ==================== */

export const TROOPS = {
  cavalry: { key: 'cavalry', name: '骑兵', short: '骑' },
  infantry: { key: 'infantry', name: '步兵', short: '步' },
  shield: { key: 'shield', name: '盾兵', short: '盾' },
  archer: { key: 'archer', name: '弓兵', short: '弓' }
}

export const TACTICS = {
  charge: { key: 'charge', name: '冲锋', cls: 'troop' },
  stratagem: { key: 'stratagem', name: '奇计', cls: 'scheme' },
  cutSupply: { key: 'cutSupply', name: '断粮计', cls: 'scheme' },
  guard: { key: 'guard', name: '援护', cls: 'troop' },
  fire: { key: 'fire', name: '火攻', cls: 'scheme' },
  hold: { key: 'hold', name: '坚守', cls: 'troop' }
}

export const RESPONSES = {
  slash: { key: 'slash', name: '击' }, // 蓝图【斩】
  dodge: { key: 'dodge', name: '挡' }, // 蓝图【避】
  heal: { key: 'heal', name: '援' } // 蓝图【疗】
}

/** 基础牌堆 50 张 */
export const BASE_RECIPE = [
  ['cavalry', 5], ['infantry', 5], ['shield', 5], ['archer', 5],
  ['charge', 4], ['stratagem', 4], ['cutSupply', 3], ['guard', 3], ['fire', 2], ['hold', 2],
  ['slash', 4], ['dodge', 5], ['heal', 3]
]

/** 战功牌堆 20 张 */
export const MERIT_RECIPE = [
  ['斩敌', 6], ['夺旗', 5], ['断粮', 5], ['救友', 4]
]

/** 战功牌 → 兑换公式描述（展示用） */
export const MERIT_FORMULA = {
  斩敌: '任意兵种 +【击】',
  夺旗: '骑兵 +【冲锋】／任意兵种 +【奇计·火攻】',
  断粮: '骑兵 / 弓兵 +【断粮计】',
  救友: '盾兵 / 步兵 +【援】或【援护】（2 人局改称【自保】）'
}

/* ==================== 克制链 ==================== */
// 骑兵 → 步兵 → 盾兵 → 计谋 → 骑兵
export const COUNTER = {
  cavalry: 'infantry',
  infantry: 'shield',
  shield: 'scheme',
  scheme: 'cavalry'
}

/** 主导牌型：兵种牌取自身；计谋类战术牌(奇计/火攻/断粮计)归为 scheme */
export function dominantOf(key) {
  if (TROOPS[key]) return key
  if (TACTICS[key] && TACTICS[key].cls === 'scheme') return 'scheme'
  if (TACTICS[key]) return key // charge/guard/hold 按搭配兵种算，见 comboDominant
  return null
}

/** 组合主导牌型（争抢用）：有兵种取兵种，否则取计谋 */
export function comboDominant(cards) {
  const troop = cards.find((c) => TROOPS[c.key])
  if (troop) return troop.key
  const hasScheme = cards.some((c) => TACTICS[c.key] && TACTICS[c.key].cls === 'scheme')
  return hasScheme ? 'scheme' : null
}

/** a 是否克制 b */
export function counters(a, b) {
  return !!a && !!b && COUNTER[a] === b
}

/* ==================== 组合公式判定 ==================== */
/**
 * 判定若干手牌可兑换哪类战功。
 * 返回 { merit, dominant } 或 null。
 * 约定：火攻在【夺旗】公式中视同奇计（同为计谋类战术牌）。
 */
export function matchCombo(cards, playerCount = 4) {
  const keys = cards.map((c) => c.key)
  const troop = keys.find((k) => !!TROOPS[k])
  const has = (k) => keys.includes(k)
  const schemeLike = has('stratagem') || has('fire') || has('cutSupply')

  // 斩敌：任意兵种 +【击】
  if (troop && has('slash')) return { merit: '斩敌', dominant: troop }
  // 夺旗：骑兵+冲锋，或 任意兵种+奇计/火攻
  if (troop === 'cavalry' && has('charge')) return { merit: '夺旗', dominant: 'cavalry' }
  if (troop && (has('stratagem') || has('fire'))) return { merit: '夺旗', dominant: troop }
  // 断粮：骑兵 / 弓兵 +【断粮计】
  if ((troop === 'cavalry' || troop === 'archer') && has('cutSupply')) return { merit: '断粮', dominant: 'scheme' }
  // 救友：盾兵 / 步兵 +【援】或【援护】
  if ((troop === 'shield' || troop === 'infantry') && (has('heal') || has('guard'))) {
    return { merit: playerCount === 2 ? '自保' : '救友', dominant: troop }
  }
  // 计谋类自成组合（奇计/火攻/断粮计视为计谋主导，可争抢）
  if (schemeLike && !troop && cards.length <= 2) return { merit: null, dominant: 'scheme' }
  return null
}

/** 2 人局救友显示名归一 */
export function meritName(name, playerCount) {
  return name === '救友' && playerCount === 2 ? '自保' : name
}

/* ==================== 董卓事件牌 12 张 ==================== */
/**
 * choice: 'dodge' 可由本人出【挡】化解 / 'leaderMerit' 盟主弃 1 战功取消 /
 *         'cutSupply' 出【断粮计】反制 / null 无选择（自动结算）
 */
export const EVENTS = [
  { id: 'E01', name: '火烧洛阳', desc: '全员弃 1 张手牌', choice: 'dodge', note: '手牌为 0 者改为摸 1 张' },
  { id: 'E02', name: '吕布出阵', desc: '战功最高者 -1 战功', choice: 'dodgeOrHold', note: '出【挡】或【盾兵+坚守】免疫' },
  { id: 'E03', name: '迁都长安', desc: '战功榜全部弃置并补满', choice: 'leaderMerit', note: '盟主可弃 1 战功取消此效果' },
  { id: 'E04', name: '粮道被劫', desc: '手牌最多者弃 2 张', choice: 'cutSupply', note: '打出【断粮计】反制' },
  { id: 'E05', name: '虎牢关挑战', desc: '各出 1 张兵种牌按克制链比大小，胜者 +1 战功', choice: 'challenge', note: '可不参与；平局无人得分' },
  { id: 'E06', name: '联军离心', desc: '本轮禁用【救友】组合与【援护】', choice: null, note: '已在场效果不追溯' },
  { id: 'E07', name: '赏罚失序', desc: '战功最低者 +1，最高者 -1', choice: null, note: '并列时均生效' },
  { id: 'E08', name: '流言四起', desc: '盟主指定一人弃 1 张手牌', choice: 'dodge', note: '该人可打出【挡】免疫' },
  { id: 'E09', name: '增兵汜水关', desc: '额外翻 1 张事件牌并立即结算', choice: null, note: '不再连锁' },
  { id: 'E10', name: '火烧粮仓', desc: '全员弃 1 张兵种牌，不足则 -1 战功', choice: null, note: '' },
  { id: 'E11', name: '天子犒军', desc: '战功最低者摸 2 张牌', choice: null, note: '' },
  { id: 'E12', name: '董卓迁怒', desc: '盟主 -1 战功，其余各摸 1 张', choice: null, note: '' }
]

/** 追赶机制事件（保证 5 分钟局不早失悬念） */
export const CATCHUP_EVENTS = ['E02', 'E07', 'E11', 'E12']

/* ==================== 武将模式映射（示例，沿用项目既有卡池） ==================== */
/** 只写 mode_effects.huimeng，不改人设、不改身份杀原技能 */
export const HERO_EFFECTS = {
  赵云: { key: 'lessCard', name: '单骑援护', desc: '每局一次：打出组合时可少 1 张牌（至少 1 张）' },
  周瑜: { key: 'extraMerit', name: '火计', desc: '打出含【火攻/奇计】的组合时，额外翻 1 张战功牌上榜' },
  司马懿: { key: 'dodgeAsTactic', name: '鬼才', desc: '每局一次：可把 1 张【挡】当任意战术牌使用' },
  诸葛亮: { key: 'keepCard', name: '屯田', desc: '事件阶段可保留 1 张手牌不被弃' },
  张辽: { key: 'challengeAll', name: '突袭', desc: '虎牢关挑战中兵种牌视为克制所有' },
  郭嘉: { key: 'peekMerit', name: '料敌', desc: '摸牌阶段可看战功牌堆顶 1 张并决定是否置底' }
}

export const HERO_LIST = Object.keys(HERO_EFFECTS)

/* ==================== 工具 ==================== */
let seq = 0
export function makeCards(recipe) {
  const out = []
  for (const [key, count] of recipe) {
    for (let i = 0; i < count; i++) out.push({ uid: `c${++seq}`, key })
  }
  return out
}

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardLabel(key) {
  if (TROOPS[key]) return TROOPS[key].name
  if (TACTICS[key]) return TACTICS[key].name
  if (RESPONSES[key]) return RESPONSES[key].name
  return key
}

export function cardGroup(key) {
  if (TROOPS[key]) return 'troop'
  if (TACTICS[key]) return 'tactic'
  if (RESPONSES[key]) return 'response'
  return 'other'
}
