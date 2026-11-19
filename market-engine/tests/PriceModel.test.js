const PriceModel = require("../src/model/PriceModel");
const STOCKS = require("../src/data/stocks.json");

const ALL = Object.keys(STOCKS);

function run(model, ticks, extra) {
  const history = [model.snapshot()];
  for (let i = 0; i < ticks; i++) history.push(model.step(extra));
  return history;
}

describe("PriceModel", () => {
  test("시작가는 stocks.json 값", () => {
    const model = new PriceModel({ codes: ALL, seed: 1 });
    for (const code of ALL) {
      expect(model.snapshot()[code]).toBe(STOCKS[code].startPrice);
    }
  });

  test("600틱 동안 1,000원 미만 없음, 한 틱 변동 ±5% 이내, 10원 단위", () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const history = run(new PriceModel({ codes: ALL, seed }), 600);
      for (let i = 1; i < history.length; i++) {
        for (const code of ALL) {
          const prev = history[i - 1][code];
          const price = history[i][code];
          expect(price >= 1000).toBe(true);
          expect(price % 10).toBe(0);
          expect(Math.abs(price - prev) / prev <= 0.05 + 1e-9).toBe(true);
        }
      }
    }
  });

  test("같은 시드면 항상 같은 가격", () => {
    const a = run(new PriceModel({ codes: ALL, seed: 42 }), 600);
    const b = run(new PriceModel({ codes: ALL, seed: 42 }), 600);
    expect(a).toEqual(b);
  });

  test("한 판(600초) 동안 가격이 실제로 움직임", () => {
    const history = run(new PriceModel({ codes: ALL, seed: 42 }), 600);
    for (const code of ALL) {
      const values = new Set(history.map((h) => h[code]));
      expect(values.size > 10).toBe(true);
    }
  });

  test("큰 하락이 이어져도 한 틱 -5%로 제한되고 1,000원 아래로 안 내려감", () => {
    const model = new PriceModel({ codes: ["KATA"], seed: 1 });
    const history = run(model, 200, { KATA: -0.5 });
    expect(history[1].KATA).toBe(14250); // 15,000원의 -5%
    expect(history[history.length - 1].KATA).toBe(1000);
  });

  test("extra로 넘긴 변화가 가격에 반영됨 (뉴스·플레이어 영향 대비)", () => {
    const up = run(new PriceModel({ codes: ["GANA"], seed: 5 }), 50, { GANA: 0.01 });
    const base = run(new PriceModel({ codes: ["GANA"], seed: 5 }), 50);
    expect(up[50].GANA > base[50].GANA).toBe(true);
  });

  test("없는 종목 코드는 오류", () => {
    expect(() => new PriceModel({ codes: ["NOPE"], seed: 1 })).toThrow();
  });
});
