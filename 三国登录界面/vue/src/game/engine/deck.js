/**
 * 牌堆操作（Game 的方法 mixin）
 * 通过 Object.assign(Game.prototype, deckMethods) 合并进引擎类。
 */
import { shuffle } from '../rules.js'

export const deckMethods = {
  drawRaw(n) {
    const out = []
    for (let i = 0; i < n; i++) {
      if (!this.state.deck.length) {
        if (!this.state.discard.length) break // 两堆皆空，无牌可摸
        this.state.deck = shuffle(this.state.discard)
        this.state.discard = []
        this.log('牌堆已尽，弃牌重洗。', 'sys')
      }
      // 兜底：重洗后仍可能为空（极端情况），绝不 push undefined 脏牌
      const card = this.state.deck.shift()
      if (card) out.push(card)
    }
    return out
  },

  drawCards(seat, n) {
    const cards = this.drawRaw(n)
    seat.hand.push(...cards)
    return cards.length
  },

  /** 弃一张手牌到弃牌堆 */
  dropCard(seat, card) {
    const i = seat.hand.findIndex((c) => c.uid === card.uid)
    if (i >= 0) {
      seat.hand.splice(i, 1)
      this.state.discard.push(card)
    }
  },

  removeHand(seat, card) {
    const i = seat.hand.findIndex((c) => c.uid === card.uid)
    if (i >= 0) seat.hand.splice(i, 1)
  },
}
