// 참가자 한 명의 현금·보유 주식과 체결 규칙 (docs/game-design.md 6-3, 6-4)
// 주의: 체결 함수 안에서 await를 쓰지 않는다 (중간에 다른 주문이 끼어들면 잔고가 꼬임)
const { GameError } = require('./errors');

const round1 = (n) => Math.round(n * 10) / 10;

class Portfolio {
  constructor(startCash) {
    this.startCash = startCash;
    this.cash = startCash;
    this.holdings = new Map(); // code → { qty, avgPrice }
  }

  static checkQty(qty) {
    if (!Number.isInteger(qty) || qty < 1) {
      throw new GameError('INVALID_QTY', 'qty must be an integer of 1 or more');
    }
  }

  // 여러 호가에 걸친 체결을 한 번에 반영 (v0.3 호가창). fills = [{ price, qty }]
  // 현금·주식이 모자라면 아무것도 바꾸지 않고 오류를 던진다
  applyFills(code, side, fills) {
    const qty = fills.reduce((sum, f) => sum + f.qty, 0);
    const amount = fills.reduce((sum, f) => sum + f.price * f.qty, 0);
    Portfolio.checkQty(qty);

    if (side === 'buy') {
      if (this.cash < amount) throw new GameError('NOT_ENOUGH_CASH', 'not enough cash');
      const held = this.holdings.get(code) ?? { qty: 0, avgPrice: 0 };
      const newQty = held.qty + qty;
      // 평균단가 = (기존 수량 × 기존 평균 + 이번 체결 금액) ÷ 새 수량, 원 단위 반올림
      this.holdings.set(code, { qty: newQty, avgPrice: Math.round((held.qty * held.avgPrice + amount) / newQty) });
      this.cash -= amount;
    } else {
      const held = this.holdings.get(code);
      if (!held || held.qty < qty) throw new GameError('NOT_ENOUGH_SHARES', 'not enough shares');
      held.qty -= qty; // 매도해도 평균단가는 그대로
      if (held.qty === 0) this.holdings.delete(code);
      this.cash += amount;
    }
    // price는 평균 체결가 (원 단위 반올림)
    return { price: Math.round(amount / qty), qty, cash: this.cash };
  }

  buy(code, qty, price) {
    Portfolio.checkQty(qty);
    return this.applyFills(code, 'buy', [{ price, qty }]);
  }

  sell(code, qty, price) {
    Portfolio.checkQty(qty);
    return this.applyFills(code, 'sell', [{ price, qty }]);
  }

  // 총자산 = 현금 + Σ(보유 수량 × 현재가). 현재가가 없으면 평균단가로 계산
  totalAsset(prices = {}) {
    let total = this.cash;
    for (const [code, { qty, avgPrice }] of this.holdings) total += qty * (prices[code] ?? avgPrice);
    return total;
  }

  // 수익률(%) = (총자산 − 시작 자금) ÷ 시작 자금 × 100, 소수점 1자리
  returnPct(prices = {}) {
    return round1(((this.totalAsset(prices) - this.startCash) / this.startCash) * 100);
  }

  // portfolio:update 형식 (G단계에서 사용)
  snapshot(prices = {}) {
    return {
      cash: this.cash,
      holdings: Object.fromEntries([...this.holdings].map(([code, h]) => [code, { ...h }])),
      totalAsset: this.totalAsset(prices),
      returnPct: this.returnPct(prices),
    };
  }
}

module.exports = { Portfolio };
