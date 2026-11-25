// 마켓메이커 봇 호가창: 현재가 위아래로 5단계 호가를 깔고, 잔량은 매 틱(1초)마다 다시 채운다
// 잔량은 방 전체가 함께 쓴다 → 먼저 사는 사람이 싼 호가를 가져가고, 나중 사람은 더 비싸게 산다
const { GameError } = require('./errors');

// 한국 호가 단위를 단순화
function tickSize(price) {
  if (price < 20000) return 10;
  if (price < 50000) return 50;
  return 100;
}

class OrderBook {
  constructor({ levels = 5, baseDepthWon = 3_000_000, depthGrowth = 1.5 } = {}) {
    Object.assign(this, { levels, baseDepthWon, depthGrowth });
    this.asks = []; // 매도호가: 싼 것부터 [{ price, qty }]
    this.bids = []; // 매수호가: 비싼 것부터
  }

  // 새 시세가 오면 호가와 잔량을 다시 만든다
  refresh(price) {
    const unit = tickSize(price);
    const depth = (p, i) => Math.max(1, Math.floor((this.baseDepthWon * this.depthGrowth ** i) / p));
    this.asks = [];
    this.bids = [];
    for (let i = 0; i < this.levels; i += 1) {
      const ask = price + unit * (i + 1);
      const bid = price - unit * (i + 1);
      this.asks.push({ price: ask, qty: depth(ask, i) });
      if (bid > 0) this.bids.push({ price: bid, qty: depth(bid, i) });
    }
  }

  // 체결 미리보기 (잔량은 건드리지 않음). 매수는 매도호가를, 매도는 매수호가를 먹는다
  quote(side, qty) {
    const book = side === 'buy' ? this.asks : this.bids;
    const fills = [];
    let left = qty;
    for (const level of book) {
      if (left === 0) break;
      const take = Math.min(left, level.qty);
      if (take > 0) fills.push({ price: level.price, qty: take });
      left -= take;
    }
    if (fills.length === 0) throw new GameError('NO_LIQUIDITY', 'no quantity left in the order book');
    return { fills, filledQty: qty - left };
  }

  // 계좌 처리까지 성공한 뒤에 잔량을 줄인다
  commit(side, fills) {
    const book = side === 'buy' ? this.asks : this.bids;
    for (const { price, qty } of fills) {
      const level = book.find((l) => l.price === price);
      if (level) level.qty -= qty;
    }
  }

  snapshot() {
    return { asks: this.asks.map((l) => ({ ...l })), bids: this.bids.map((l) => ({ ...l })) };
  }
}

module.exports = { OrderBook, tickSize };
