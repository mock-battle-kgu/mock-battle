// 시세(틱) 5개를 묶어 캔들 하나(시가·고가·저가·종가·거래량)를 만든다 (docs/protocol.md candle:close)
// 캔들 k = t가 5k-4 ~ 5k인 틱. t=0은 시작가라 캔들에 넣지 않는다.
// 틱이 빠져도 각 틱이 속한 구간으로 나눠서, 다른 구간의 시세가 섞이지 않게 한다.
class CandleBuilder {
  constructor(size = 5) {
    this.size = size;
    this.current = {}; // code → { o, h, l, c }
    this.count = 0;
    this.endT = 0; // 지금 모으는 캔들이 닫히는 시점 (5, 10, 15, ...)
    this.lastT = 0; // 마지막으로 받은 틱의 t
    this.pendingVolume = {}; // 다음 틱 캔들에 더할 거래량: code → 수량 (v0.3)
  }

  // 거래량을 쌓아 두었다가 다음 add() 때 그 틱의 캔들에 더한다 (v0.3)
  // - 시세 엔진의 시장 거래량: 그 틱 직전에 호출 → 그 틱 캔들에 들어감
  // - 참가자 체결 수량: 틱 사이에 호출 → 다음 틱 캔들에 들어감
  addVolume(code, qty) {
    if (!(qty > 0)) return;
    this.pendingVolume[code] = (this.pendingVolume[code] ?? 0) + qty;
  }

  // t가 속한 캔들의 끝 시점 (t=1~5 → 5, t=6~10 → 10)
  endOf(t) {
    return Math.ceil(t / this.size) * this.size;
  }

  // 이번 틱으로 완성된 캔들 목록 (없으면 빈 배열)
  add(t, prices) {
    if (t <= 0 || t <= this.lastT) return []; // 시작가와 이미 지난 틱은 넣지 않는다
    this.lastT = t;
    const closed = [];
    const endT = this.endOf(t);

    // 경계 틱(예: t=5)이 빠지고 다음 구간 틱이 먼저 오면, 이전 캔들을 원래 경계 시점으로 닫는다
    if (this.count > 0 && endT > this.endT) closed.push(this.flush(this.endT));
    this.endT = endT;

    for (const [code, price] of Object.entries(prices)) {
      const volume = this.pendingVolume[code] ?? 0;
      delete this.pendingVolume[code];
      const candle = this.current[code];
      if (!candle) {
        this.current[code] = { o: price, h: price, l: price, c: price, v: volume };
      } else {
        candle.h = Math.max(candle.h, price);
        candle.l = Math.min(candle.l, price);
        candle.c = price;
        candle.v += volume;
      }
    }
    this.count += 1;

    if (t === endT) closed.push(this.flush(t));
    return closed;
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