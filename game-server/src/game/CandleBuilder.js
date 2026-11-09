// 시세(틱) 5개를 묶어 캔들 하나(시가·고가·저가·종가)를 만든다 (docs/protocol.md candle:close)
// 캔들 k = t가 5k-4 ~ 5k인 틱. t=0은 시작가라 캔들에 넣지 않는다.
// 틱이 하나 빠져도 t가 5의 배수가 되면 그때까지 모인 것으로 닫는다.
class CandleBuilder {
  constructor(size = 5) {
    this.size = size;
    this.current = {}; // code → { o, h, l, c }
    this.count = 0;
  }

  // 캔들이 완성되면 { t, candles }, 아니면 null
  add(t, prices) {
    if (t <= 0) return null;
    for (const [code, price] of Object.entries(prices)) {
      const candle = this.current[code];
      if (!candle) {
        this.current[code] = { o: price, h: price, l: price, c: price };
      } else {
        candle.h = Math.max(candle.h, price);
        candle.l = Math.min(candle.l, price);
        candle.c = price;
      }
    }
    this.count += 1;
    return t % this.size === 0 ? this.flush(t) : null;
  }

  // 모인 틱으로 캔들을 닫는다 (게임이 5의 배수가 아닌 시점에 끝날 때도 사용)
  flush(t) {
    if (this.count === 0) return null;
    const closed = { t, candles: this.current };
    this.current = {};
    this.count = 0;
    return closed;
  }
}

module.exports = { CandleBuilder };
