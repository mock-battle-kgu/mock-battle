// 대결 모드 가격 생성 (가이드 4장)
// P(t+1) = P(t) × (1 + σZ + n + f)
// n(뉴스)과 f(플레이어 영향)는 F·G단계에서 extra로 넘겨줍니다.
const config = require("../config");
const STOCKS = require("../data/stocks.json");
const { createRandom } = require("./random");

class PriceModel {
  /**
   * @param {object} options codes(종목 코드 배열), seed, stocks, rules
   */
  constructor({ codes, seed, stocks = STOCKS, rules = config.price }) {
    this.random = createRandom(seed);
    this.rules = rules;
    this.codes = codes;
    this.sigma = {};
    this.prices = {};

    for (const code of codes) {
      const info = stocks[code];
      if (!info) throw new Error(`알 수 없는 종목: ${code}`);
      this.sigma[code] = info.sigma;
      this.prices[code] = info.startPrice;
    }
  }

  // 한 틱 진행: extra는 종목별 추가 변화율 (예: { GANA: 0.008 })
  step(extra = {}) {
    for (const code of this.codes) {
      const change = this.sigma[code] * this.random.normal() + (extra[code] || 0);
      this.prices[code] = this.nextPrice(this.prices[code], change);
    }
    return this.snapshot();
  }

  // 순서: ±5% 제한 → 10원 단위 → 최저가
  nextPrice(price, change) {
    const { maxTickChange, minPrice, unit } = this.rules;
    const limited = Math.max(-maxTickChange, Math.min(maxTickChange, change));
    const high = price * (1 + maxTickChange);
    const low = price * (1 - maxTickChange);

    let next = Math.round((price * (1 + limited)) / unit) * unit;
    // 10원 반올림 때문에 ±5%를 살짝 넘는 경우를 막음
    if (next > high) next = Math.floor(high / unit) * unit;
    if (next < low) next = Math.ceil(low / unit) * unit;
    return Math.max(minPrice, next);
  }

  snapshot() {
    return { ...this.prices };
  }
}

module.exports = PriceModel;
