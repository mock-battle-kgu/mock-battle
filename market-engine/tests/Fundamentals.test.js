const { makeFundamentals, scaleScenarioFundamentals } = require("../src/model/Fundamentals");
const PriceModel = require("../src/model/PriceModel");
const { createRandom } = require("../src/model/random");
const STOCKS = require("../src/data/stocks.json");

const ALL = Object.keys(STOCKS);

describe("Fundamentals", () => {
  test("stocks.json: 종목마다 sector, eps, bps, sectorPer가 있음", () => {
    for (const code of ALL) {
      const s = STOCKS[code];
      expect(typeof s.sector).toBe("string");
      expect(s.eps > 0 && s.bps > 0 && s.sectorPer > 0).toBe(true);
    }
  });

  test("같은 시드면 같은 EPS", () => {
    const a = makeFundamentals(ALL, createRandom(7));
    const b = makeFundamentals(ALL, createRandom(7));
    expect(a).toEqual(b);
  });

  test("EPS는 기준값의 ±20% 안, 10원 단위", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const f = makeFundamentals(ALL, createRandom(seed));
      for (const code of ALL) {
        const base = STOCKS[code].eps;
        expect(f[code].eps >= base * 0.8 - 10 && f[code].eps <= base * 1.2 + 10).toBe(true);
        expect(f[code].eps % 10).toBe(0);
      }
    }
  });

  test("판마다 저평가 종목이 달라짐 (EPS가 흔들림)", () => {
    const set = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const f = makeFundamentals(ALL, createRandom(seed));
      const cheapest = ALL.reduce((best, code) => {
        const ratio = (f[code].eps * f[code].sectorPer) / STOCKS[code].startPrice;
        return ratio > best.ratio ? { code, ratio } : best;
      }, { code: null, ratio: -Infinity });
      set.add(cheapest.code);
    }
    expect(set.size >= 2).toBe(true);
  });

  test("저평가 종목은 시드 20개 평균으로 600틱 뒤 가격이 올라 있음", () => {
    // GANA: 적정가 4,000 × 13 = 52,000 > 시작가 46,000
    const fundamentals = { GANA: { eps: 4000, sectorPer: 13 } };
    let sum = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const model = new PriceModel({ codes: ["GANA"], seed, fundamentals });
      for (let t = 0; t < 600; t++) model.step();
      sum += model.prices.GANA;
    }
    expect(sum / 20 > 46000 * 1.05).toBe(true);
  });

  test("고평가 종목은 시드 20개 평균으로 600틱 뒤 가격이 내려가 있음", () => {
    // SAAH: 적정가 900 × 50 = 45,000 < 시작가 54,000
    const fundamentals = { SAAH: { eps: 900, sectorPer: 50 } };
    let sum = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const model = new PriceModel({ codes: ["SAAH"], seed, fundamentals });
      for (let t = 0; t < 600; t++) model.step();
      sum += model.prices.SAAH;
    }
    expect(sum / 20 < 54000 * 0.95).toBe(true);
  });

  test("지표가 없으면 적정가 회귀 없이 기존과 같은 가격", () => {
    const a = new PriceModel({ codes: ALL, seed: 42 });
    const b = new PriceModel({ codes: ALL, seed: 42, fundamentals: null });
    for (let t = 0; t < 100; t++) expect(a.step()).toEqual(b.step());
  });

  test("연습 모드: 줄인 EPS로 계산한 PER이 실제 PER과 같고 sector가 없음", () => {
    const scenario = {
      firstClose: 55200,
      fundamentals: { sector: "반도체", eps: 3166, bps: 37528, sectorPer: 15 },
    };
    const f = scaleScenarioFundamentals(scenario, "STOCK_A");
    const realPer = 55200 / 3166;
    const scaledPer = 10000 / f.STOCK_A.eps;
    expect(Math.abs(scaledPer - realPer) / realPer < 0.01).toBe(true);
    const realPbr = 55200 / 37528;
    const scaledPbr = 10000 / f.STOCK_A.bps;
    expect(Math.abs(scaledPbr - realPbr) / realPbr < 0.01).toBe(true);
    expect(f.STOCK_A.sector).toBe(undefined);
    expect(f.STOCK_A.sectorPer).toBe(15);
  });

  test("연습 모드: 적자(음수 EPS), 비어 있는 BPS도 처리", () => {
    const f = scaleScenarioFundamentals(
      { firstClose: 20000, fundamentals: { eps: -1000, bps: null, sectorPer: 15 } },
      "STOCK_A"
    );
    expect(f.STOCK_A.eps).toBe(-500);
    expect(f.STOCK_A.bps).toBe(null);
  });

  test("연습 모드: 지표나 첫 종가가 없으면 null", () => {
    expect(scaleScenarioFundamentals({ firstClose: 1000 }, "STOCK_A")).toBe(null);
    expect(scaleScenarioFundamentals({ fundamentals: { eps: 1 } }, "STOCK_A")).toBe(null);
    expect(scaleScenarioFundamentals(null, "STOCK_A")).toBe(null);
  });
});
