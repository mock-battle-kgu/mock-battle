// 대결 모드 시장 거래량 (가이드 4-6)
// 매 틱 거래량 = 기본(1초 1,000만 원어치) × 무작위 배수(평균 약 1) × (1 + |이번 틱 변화율| ÷ σ)
// → 가격이 크게 움직이거나 뉴스가 나면 거래량이 늘어남
const config = require("../config");
const STOCKS = require("../data/stocks.json");
const { createRandom } = require("./random");

class VolumeModel {
  constructor({ codes, seed, stocks = STOCKS, rules = config.volume }) {
    this.random = createRandom(seed);
    this.rules = rules;
    this.codes = codes;
    this.base = {};
    this.sigma = {};
    for (const code of codes) {
      this.base[code] = rules.baseWon / stocks[code].startPrice;
      this.sigma[code] = stocks[code].sigma;
    }
  }

  // before → after 가격 변화로 이번 틱 거래량 계산
  step(before, after) {
    const volumes = {};
    for (const code of this.codes) {
      const change = Math.abs(after[code] / before[code] - 1);
      const noise = Math.exp(this.rules.noise * this.random.normal());
      volumes[code] = Math.round(this.base[code] * noise * (1 + change / this.sigma[code]));
    }
    return volumes;
  }

  zero() {
    return Object.fromEntries(this.codes.map((code) => [code, 0]));
  }
}

module.exports = VolumeModel;
