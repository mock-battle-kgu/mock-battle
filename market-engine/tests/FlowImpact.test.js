const FlowImpact = require("../src/model/FlowImpact");

const CODES = ["GANA", "DARA"];

describe("FlowImpact", () => {
  test("매수 우세면 +, 매도 우세면 -", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: 300, DARA: -200 });
    const impact = flow.impactAt(1);
    expect(impact.GANA).toBe(0.6); // 300 / 1000 × 2
    expect(impact.DARA).toBe(-0.4);
  });

  test("최근 10초 순매수량을 합산", () => {
    const flow = new FlowImpact({ codes: CODES });
    for (let t = 1; t <= 5; t++) flow.add(t, { GANA: 100 });
    expect(flow.impactAt(5).GANA).toBe(1); // 500 / 1000 × 2
  });

  test("±3%를 넘지 않음", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: 100000, DARA: -100000 });
    const impact = flow.impactAt(1);
    expect(impact.GANA).toBe(3);
    expect(impact.DARA).toBe(-3);
  });

  test("10초 지나면 영향 사라짐", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: 500 });
    expect(flow.impactAt(10).GANA).toBe(1);
    expect(flow.impactAt(11).GANA).toBe(0);
  });

  test("한 번의 순매수는 10초에 나눠 반영되고 합이 impactPct와 같음", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: 500 }); // impactPct 1%
    let total = 0;
    for (let t = 1; t <= 15; t++) {
      const extra = flow.extraFrom(flow.impactAt(t));
      total += extra.GANA || 0;
    }
    expect(Math.abs(total * 100 - 1) < 1e-9).toBe(true);
  });

  test("방에 없는 종목, 숫자가 아닌 값은 무시", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: "abc", KATA: 900, DARA: 100 });
    expect(flow.impactAt(1)).toEqual({ GANA: 0, DARA: 0.2 });
  });

  test("형식이 틀린 flow는 기록하지 않음", () => {
    const flow = new FlowImpact({ codes: CODES });
    expect(flow.add("1", { GANA: 100 })).toBe(false);
    expect(flow.add(1, null)).toBe(false);
    expect(flow.impactAt(1)).toEqual({ GANA: 0, DARA: 0 });
  });

  test("순매수가 없으면 0 (-0이 아님)", () => {
    const flow = new FlowImpact({ codes: CODES });
    flow.add(1, { GANA: -1 }); // -0.002% → 반올림하면 0
    expect(Object.is(flow.impactAt(1).GANA, 0)).toBe(true);
  });
});
