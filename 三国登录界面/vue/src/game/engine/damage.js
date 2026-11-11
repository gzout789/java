/**
 * 伤害结算 / 濒死救援 / 阵亡 / 胜负判定（Game 的方法 mixin）
 */
import { cardName, isRedCard, ROLES } from '../rules.js'
import { aiAskSave } from '../ai.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const damageMethods = {
  async damage(source, target, amount, cause) {
    // 藤甲：来源无兵刃时减伤
    if (target.equip.armor && target.equip.armor.key === 'armor2') {
      if (!source || !source.equip.weapon) {
        amount -= 1
        if (amount <= 0) {
          this.log(`${target.label} 身披藤甲，创伤无存。`, 'skill')
          return
        }
      }
    }
    // 谦冲：计略造成的创伤 -1
    const SCHEME_CAUSES = ['探囊', '困局', '断粮', '惊雷', '惑敌', '乱击', '火烧赤壁', '夷陵', '离间']
    if (this.hasEffect(target, 'scheme_resist') && SCHEME_CAUSES.includes(cause)) {
      amount -= 1
      if (amount <= 0) {
        this.log(`${target.label} 生性谦冲，计略如风过岗。`, 'skill')
        return
      }
    }
    target.hp -= amount
    /* cause 可能是内部键（例如 'slash'），战报里一律翻成中文牌名，别让玩家看到英文键 */
    this.log(`${target.label} 受到 ${amount} 点创伤（${cause ? cardName(cause) : '交锋'}），剩余 ${Math.max(target.hp, 0)} 点体力。`, 'hit')

    // 受伤触发的应策（一名武将可有多个应策，依次结算）
    if (this.hasEffect(target, 'hurt_draw1')) {
      const sk = this.skillOf(target, 'hurt_draw1')
      this.drawCards(target, 1)
      this.log(`${target.label} 发动【${sk.name}】，摸一张牌。`, 'skill')
    }
    if (this.hasEffect(target, 'hurt_draw2')) {
      const sk = this.skillOf(target, 'hurt_draw2')
      this.drawCards(target, 2)
      this.log(`${target.label} 发动【${sk.name}】，摸两张牌。`, 'skill')
    }
    if (this.hasEffect(target, 'hurt_steal') && source && source.hand.length) {
      const sk = this.skillOf(target, 'hurt_steal')
      const i = Math.floor(Math.random() * source.hand.length)
      const card = source.hand.splice(i, 1)[0]
      target.hand.push(card)
      this.log(`${target.label} 发动【${sk.name}】，取得 ${source.label} 一张手牌。`, 'skill')
    }
    if (this.hasEffect(target, 'retaliate') && source && source.alive) {
      const sk = this.skillOf(target, 'retaliate')
      this.log(`${target.label} 发动【${sk.name}】，反噬 ${source.label}。`, 'skill')
      source.hp -= 1
      if (source.hp <= 0) await this.dying(source, target)
    }
    // 拔矢啖睛：受【击】后令来源二选一——弃两张手牌或受 1 点创伤
    if (this.hasEffect(target, 'retaliate_choice') && source && source.alive && cause === 'slash') {
      const sk = this.skillOf(target, 'retaliate_choice')
      this.log(`${target.label} 拔矢啖睛，怒视 ${source.label}！`, 'skill')
      await this.choiceDiscardOrDamage(target, source, sk)
    }

    // 造成击杀伤害后的抽牌（太史慈·神射）
    if (source && cause === 'slash' && this.hasEffect(source, 'slash_draw')) {
      const sk = this.skillOf(source, 'slash_draw')
      this.drawCards(source, 1)
      this.log(`${source.label} 的【${sk.name}】生效，箭无虚发，摸一张牌。`, 'skill')
    }

    if (target.hp <= 0) {
      await this.dying(target, source)
    }
    this.afterAction()
  },

  /** 令 source 二选一：弃两张手牌，或受 1 点创伤（拔矢啖睛） */
  async choiceDiscardOrDamage(from, source, sk) {
    if (source.hand.length >= 2) {
      // 有两张牌可弃：AI 与玩家统一自动弃置（保命优先）
      const drops = [source.hand[0], source.hand[1]]
      for (const c of drops) this.dropCard(source, c)
      this.log(`${source.label} 忍痛弃去两张手牌，避其锋芒。`, 'skill')
      return
    }
    this.log(`${source.label} 无牌可弃，受 ${from.label}【${sk.name}】反噬，受 1 点创伤。`, 'skill')
    source.hp -= 1
    if (source.hp <= 0) await this.dying(source, from)
  },

  /** 濒死：依次询问求援 */
  async dying(target, source) {
    this.log(`${target.label} 气血将尽，命悬一线！`, 'death')
    const n = this.state.seats.length
    for (let i = 0; i < n; i++) {
      const saver = this.state.seats[(target.idx + i) % n]
      // 濒死之人救不了自己，从下家开始依次询问
      if (!saver.alive || saver.idx === target.idx) continue
      // 刮骨：红色手牌也可当【援】
      const heal = this.findHealCard(saver)
      if (!heal) continue
      let use = false
      if (saver.isAI) {
        use = aiAskSave(this, saver, target)
        if (use) {
          const card = this.findHealCard(saver)
          this.removeHand(saver, card)
          this.state.discard.push(card)
          target.hp = 1
          if (card.key !== 'heal') {
            const sk = this.skillOf(saver, 'dying_heal_red')
            this.log(`${saver.label} 发动【${sk.name}】，刮骨去毒，救下 ${target.label}，体力回到 1 点。`, 'good')
          } else {
            this.log(`${saver.label} 以【援】救下 ${target.label}，体力回到 1 点。`, 'good')
          }
          return true
        }
      } else {
        const tok = this.pushPending({
          kind: 'save',
          idx: saver.idx,
          allowRed: this.hasEffect(saver, 'dying_heal_red'),
          text: `${target.label} 濒死，你是否出【援】相救？`
        })
        const action = await this.waitHuman()
        this.clearPending(tok)
        if (action && action.type === 'save') {
          const card = saver.hand.find((c) => c.uid === action.cardUid)
          if (card) {
            this.removeHand(saver, card)
            this.state.discard.push(card)
            target.hp = 1
            this.log(`你以【${card.key === 'heal' ? '援' : '刮骨'}】救下 ${target.label}，体力回到 1 点。`, 'good')
            return true
          }
        }
      }
    }
    await this.death(target, source)
    return false
  },

  /** 可用于救人【援】的牌：普通【援】；刮骨加持下红牌也算 */
  findHealCard(seat) {
    if (!seat || !seat.hand || !seat.hand.length) return null
    const plain = seat.hand.find((c) => c.key === 'heal')
    if (plain) return plain
    if (this.hasEffect(seat, 'dying_heal_red')) {
      return seat.hand.find((c) => isRedCard(c))
    }
    return null
  },

  async death(target, killer) {
    target.alive = false
    target.roleOpen = true

    // 高平陵：司马懿可尽取阵亡者之物（自动发动，一局一次，纯收益）
    const looter = this.state.seats.find(
      (s) => s.alive && s.idx !== target.idx && !s.secretUsed && this.hasEffect(s, 'secret_loot')
    )
    if (looter) {
      const loot = [...target.hand, ...Object.values(target.equip).filter(Boolean)]
      looter.secretUsed = true
      looter.hand.push(...loot)
      target.hand = []
      target.equip = { weapon: null, armor: null, minusHorse: null, plusHorse: null }
      if (looter.hp < looter.maxHp) looter.hp += 1
      const sk = this.skillOf(looter, 'secret_loot')
      this.log(
        `${looter.label} 发动秘计【${sk.name}】，尽收 ${target.label} 遗物${loot.length ? `（${loot.length} 张）` : ''}，声威大振！`,
        'skill'
      )
    }

    // 手牌与装备进弃牌堆
    this.state.discard.push(...target.hand, ...Object.values(target.equip).filter(Boolean), ...target.traps)
    target.hand = []
    target.equip = { weapon: null, armor: null, minusHorse: null, plusHorse: null }
    target.traps = []

    this.log(`${target.label}（${target.hero.name}）阵亡，翻开身份——【${ROLES[target.role].name}】。`, 'death')
    if (target.role === 'rebel' && killer && killer.alive) {
      this.drawCards(killer, 3)
      this.log(`${killer.label} 剿灭群雄，缴获物资，摸 3 张牌。`, 'good')
    }

    // 袁绍·乱击的秘计在死亡后无意义，无需处理
    this.checkWin()
    await wait(400)
  },

  checkWin() {
    const alive = this.state.seats.filter((s) => s.alive)
    const lord = this.state.seats.find((s) => s.role === 'lord')
    const lordAlive = !!lord && lord.alive
    const rebels = alive.filter((s) => s.role === 'rebel')
    const spies = alive.filter((s) => s.role === 'spy')

    let winner = null
    if (!lordAlive) {
      if (alive.length === 1 && alive[0].role === 'spy') {
        winner = { side: 'spy', text: '隐客独存，揽天下于掌中——隐客胜' }
      } else {
        winner = { side: 'rebel', text: '汉主崩殂，汉室倾覆——群雄胜' }
      }
    } else if (!rebels.length && !spies.length) {
      winner = { side: 'lord', text: '群雄授首，隐客伏诛，天下太平——汉主与忠良胜' }
    } else if (alive.every((s) => s.role === 'spy')) {
      winner = { side: 'spy', text: '群雄与忠良尽殁——隐客胜' }
    }

    if (winner) {
      const me = this.state.seats[0]
      const win =
        (winner.side === 'lord' && (me.role === 'lord' || me.role === 'loyal')) ||
        (winner.side === 'rebel' && me.role === 'rebel') ||
        (winner.side === 'spy' && me.role === 'spy')
      winner.playerWin = win
      this.state.winner = winner
      this.state.phase = 'over'
      this.log(`战事终结：${winner.text}。你${win ? '得胜' : '败北'}。`, win ? 'good' : 'death')
      // 胜负已分：清掉残留的响应询问并唤醒全部等待，避免结算界面还挂着旧按钮
      this.clearAllPending()
      this.resolveWait(null)
    }
    return winner
  },
}
