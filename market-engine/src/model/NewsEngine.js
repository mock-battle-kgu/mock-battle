// 대결 모드 진짜 뉴스 (가이드 4-2)
// - 40~90초마다 무작위로 뉴스 1개 발생 (10분에 7~12개 정도)
// - 뉴스는 먼저 발행하고, 가격에는 다음 틱부터 5틱에 나눠 반영
//   (참가자가 뉴스를 보고 반응할 시간을 줌)
const config = require("../config");
const NEWS = require("../data/news.json");
const { createRandom } = require("./random");

class NewsEngine {
  /**
   * @param {object} options codes(방의 종목), seed, news, rules
   */
  constructor({ codes, seed, news = NEWS, rules = config.news }) {
    this.random = createRandom(seed);
    this.rules = rules;
    // 방에 있는 종목의 뉴스만 후보로 사용
    this.pool = codes.flatMap((code) =>
      (news[code] || []).map((item) => ({ stock: code, ...item }))
    );
    this.used = new Set(); // 한 판에 같은 뉴스가 두 번 나오지 않게
    this.pending = []; // 아직 가격에 다 반영되지 않은 효과 { stock, perTick, fromT, toT }
    this.nextAt = this.gap();
  }

  // 다음 뉴스까지 간격 (minGapSec ~ maxGapSec 초)
  gap() {
    const { minGapSec, maxGapSec } = this.rules;
    return minGapSec + Math.floor(this.random.next() * (maxGapSec - minGapSec + 1));
  }

  /**
   * t초에 발행할 뉴스 (없으면 null)
   * durationSec 직전에는 반응할 시간이 없으므로 새 뉴스를 내지 않음
   */
  emit(t, durationSec) {
    if (t < this.nextAt) return null;
    this.nextAt = t + this.gap();
    if (t > durationSec - this.rules.quietEndSec) return null;

    const candidates = this.pool.filter((_, i) => !this.used.has(i));
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(this.random.next() * candidates.length)];
    this.used.add(this.pool.indexOf(pick));

    const { spreadTicks } = this.rules;
    this.pending.push({
      stock: pick.stock,
      perTick: pick.effectPct / 100 / spreadTicks,
      fromT: t + 1, // 다음 틱부터
      toT: t + spreadTicks,
    });
    return { t, stock: pick.stock, headline: pick.headline, effectPct: pick.effectPct };
  }

  // t초 가격 계산에 더할 종목별 변화율 (PriceModel.step의 extra)
  effectsAt(t) {
    const extra = {};
    for (const e of this.pending) {
      if (t >= e.fromT && t <= e.toT) {
        extra[e.stock] = (extra[e.stock] || 0) + e.perTick;
      }
    }
    this.pending = this.pending.filter((e) => e.toT > t);
    return extra;
  }
}

module.exports = NewsEngine;
