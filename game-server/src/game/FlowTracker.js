// 참가자 매수·매도량 집계 (docs/game-design.md 2-3, protocol.md market.flow · market:flow)
// - 1초마다: 지난 1초의 순매수량(netQty)을 시세 엔진에 보낸다 → 시세 엔진이 가격에 반영
// - 화면용: 최근 windowSec초 동안의 매수 비율(buyRatio)을 계산한다 → 매수 압력 게이지
class FlowTracker {
  constructor(windowSec = 10) {
    this.windowSec = windowSec;
    this.current = {}; // 지금 1초 동안의 체결: code → { buy, sell }
    this.history = []; // 최근 windowSec초의 1초 묶음 (오래된 것부터)
  }

  // 체결될 때마다 호출 (실제 체결 수량 기준)
  record(code, side, qty) {
    const bucket = (this.current[code] ??= { buy: 0, sell: 0 });
    bucket[side] += qty;
  }

  // 1초 마감: 지난 1초의 순매수량을 돌려주고, 최근 기록에 넣는다
  roll() {
    const second = this.current;
    this.current = {};
    this.history.push(second);
    if (this.history.length > this.windowSec) this.history.shift();
    return Object.fromEntries(Object.entries(second).map(([code, { buy, sell }]) => [code, buy - sell]));
  }

  // 최근 windowSec초의 매수 비율 (0~1, 소수점 2자리). 거래가 없던 종목은 빠진다
  buyRatio() {
    const sum = {};
    for (const second of this.history) {
      for (const [code, { buy, sell }] of Object.entries(second)) {
        const s = (sum[code] ??= { buy: 0, sell: 0 });
        s.buy += buy;
        s.sell += sell;
      }
    }
    const ratio = {};
    for (const [code, { buy, sell }] of Object.entries(sum)) {
      if (buy + sell > 0) ratio[code] = Math.round((buy / (buy + sell)) * 100) / 100;
    }
    return ratio;
  }
}

module.exports = { FlowTracker };
