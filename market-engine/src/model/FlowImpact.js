// 플레이어 시장 영향 (가이드 4-3)
// 게임 서버가 1초마다 보내는 종목별 순매수량(netQty = 매수 - 매도)을 모아
// 최근 10초 합계로 impactPct를 계산하고, 가격에는 10초에 나눠 반영
const config = require("../config");

class FlowImpact {
  /**
   * @param {object} options codes(방의 종목), rules
   */
  constructor({ codes, rules = config.flow }) {
    this.codes = codes;
    this.rules = rules;
    this.flows = new Map(); // t → { 종목: netQty }
  }

  // market.flow 한 건 기록 (같은 t가 다시 오면 덮어씀)
  add(t, netQty) {
    if (!Number.isInteger(t) || !netQty || typeof netQty !== "object") return false;
    const clean = {};
    for (const code of this.codes) {
      const qty = Number(netQty[code]);
      if (Number.isFinite(qty) && qty !== 0) clean[code] = qty;
    }
    this.flows.set(t, clean);
    return true;
  }

  // 최근 10초(t-9 ~ t) 순매수량 합계
  netQtyAt(t) {
    const { windowSec } = this.rules;
    const sum = Object.fromEntries(this.codes.map((code) => [code, 0]));
    for (const [ft, qty] of this.flows) {
      if (ft > t - windowSec && ft <= t) {
        for (const code in qty) sum[code] += qty[code];
      }
    }
    // 오래된 기록 정리
    for (const ft of this.flows.keys()) {
      if (ft <= t - windowSec) this.flows.delete(ft);
    }
    return sum;
  }

  // 종목별 impactPct (%), 화면의 "가격 +1.8% 반영" 표시에 사용
  impactAt(t) {
    const { baseVolume, multiplier, maxImpactPct } = this.rules;
    const sum = this.netQtyAt(t);
    const impact = {};
    for (const code of this.codes) {
      const raw = (sum[code] / baseVolume) * multiplier;
      const limited = Math.max(-maxImpactPct, Math.min(maxImpactPct, raw));
      impact[code] = Math.round(limited * 10) / 10 || 0; // 소수점 1자리, -0 방지
    }
    return impact;
  }

  // t초 가격 계산에 더할 변화율 (PriceModel.step의 extra)
  // impactPct를 10초에 나눠 반영 → 순매수가 10초 동안 이어지면 총 impactPct만큼 움직임
  extraFrom(impact) {
    const { windowSec } = this.rules;
    const extra = {};
    for (const code in impact) {
      if (impact[code] !== 0) extra[code] = impact[code] / 100 / windowSec;
    }
    return extra;
  }
}

module.exports = FlowImpact;
