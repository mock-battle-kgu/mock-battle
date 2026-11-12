const { createRandom } = require("../src/model/random");

describe("random", () => {
  test("같은 시드면 같은 숫자 열", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  test("다른 시드면 다른 숫자 열", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  test("next()는 0 이상 1 미만", () => {
    const r = createRandom(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });

  test("normal()은 평균 약 0, 표준편차 약 1", () => {
    const r = createRandom(123);
    const n = 20000;
    const values = Array.from({ length: n }, () => r.normal());
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    expect(Math.abs(mean) < 0.05).toBe(true);
    expect(Math.abs(sd - 1) < 0.05).toBe(true);
  });
});
