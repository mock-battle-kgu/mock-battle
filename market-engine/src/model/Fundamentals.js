// 종목 지표 (가이드 4-5, v0.3 중간발표 피드백)
const STOCKS = require("../data/stocks.json");

/**
 * 대결 모드: 판마다 EPS를 기준값의 ±20% 안에서 흔들어 매번 다른 종목이 저평가되게 함
 * (같은 시드면 같은 값, 10원 단위)
 */
function makeFundamentals(codes, random, stocks = STOCKS) {
  return Object.fromEntries(
    codes.map((code) => {
      const s = stocks[code];
      const eps = Math.round((s.eps * (0.8 + 0.4 * random.next())) / 10) * 10;
      return [code, { sector: s.sector, eps, bps: s.bps, sectorPer: s.sectorPer }];
    })
  );
}

/**
 * 연습 모드: 시나리오의 실제 지표를 가격과 같은 비율(10,000 ÷ 실제 첫 종가)로 줄임
 * → PER·PBR은 실제와 같고, 금액만 보고는 종목을 알 수 없음
 * 업종(sector)은 종목을 짐작할 수 있어서 빼고 보냄
 */
function scaleScenarioFundamentals(scenario, code, basePrice = 10000) {
  const f = scenario && scenario.fundamentals;
  if (!f || !scenario.firstClose) return null; // 값이 없는 시나리오는 지표 없이 진행
  const scale = basePrice / scenario.firstClose;
  const scaled = (v) => (typeof v === "number" ? Math.round(v * scale) : null);
  return {
    [code]: { eps: scaled(f.eps), bps: scaled(f.bps), sectorPer: f.sectorPer ?? null },
  };
}

module.exports = { makeFundamentals, scaleScenarioFundamentals };
