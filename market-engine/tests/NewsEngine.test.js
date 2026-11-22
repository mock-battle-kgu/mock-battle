const NewsEngine = require("../src/model/NewsEngine");
const NEWS = require("../src/data/news.json");

const ALL = Object.keys(NEWS);

// 한 판(600초)을 돌리며 발행된 뉴스와 틱별 효과를 기록
function play(engine, durationSec = 600) {
  const emitted = [];
  const effects = [];
  for (let t = 1; t <= durationSec; t++) {
    effects.push({ t, extra: engine.effectsAt(t) });
    const news = engine.emit(t, durationSec);
    if (news) emitted.push(news);
  }
  return { emitted, effects };
}

describe("NewsEngine", () => {
  test("news.json: 종목마다 호재 3개, 악재 3개", () => {
    for (const code of ALL) {
      const items = NEWS[code];
      expect(items.filter((n) => n.effectPct > 0).length).toBe(3);
      expect(items.filter((n) => n.effectPct < 0).length).toBe(3);
    }
  });

  test("10분에 뉴스 7~12개", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { emitted } = play(new NewsEngine({ codes: ALL, seed }));
      expect(emitted.length >= 7 && emitted.length <= 12).toBe(true);
    }
  });

  test("뉴스 간격은 40~90초", () => {
    for (const seed of [1, 7, 42, 2026]) {
      const { emitted } = play(new NewsEngine({ codes: ALL, seed }));
      expect(emitted[0].t >= 40 && emitted[0].t <= 90).toBe(true);
      for (let i = 1; i < emitted.length; i++) {
        const gap = emitted[i].t - emitted[i - 1].t;
        expect(gap >= 40 && gap <= 90).toBe(true);
      }
    }
  });

  test("끝나기 15초 전부터는 새 뉴스 없음", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { emitted } = play(new NewsEngine({ codes: ALL, seed }));
      expect(emitted.every((n) => n.t <= 585)).toBe(true);
    }
  });

  test("한 판에 같은 뉴스가 두 번 나오지 않음", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { emitted } = play(new NewsEngine({ codes: ALL, seed }));
      const headlines = emitted.map((n) => n.headline);
      expect(new Set(headlines).size).toBe(headlines.length);
    }
  });

  test("방에 있는 종목의 뉴스만 나옴", () => {
    const { emitted } = play(new NewsEngine({ codes: ["GANA", "DARA"], seed: 3 }));
    expect(emitted.length > 0).toBe(true);
    expect(emitted.every((n) => n.stock === "GANA" || n.stock === "DARA")).toBe(true);
  });

  test("효과는 발행한 다음 틱부터 5틱 동안, 합이 effectPct와 같음", () => {
    const engine = new NewsEngine({ codes: ["SAAH"], seed: 11 });
    const { emitted, effects } = play(engine);
    const first = emitted[0];
    const window = effects.filter((e) => e.t >= first.t && e.t <= first.t + 6);

    // 발행한 틱에는 아직 효과 없음
    expect(window[0].extra.SAAH).toBe(undefined);
    // 다음 5틱 동안 효과, 그다음 틱에는 없음
    const applied = window.slice(1, 6).map((e) => e.extra.SAAH);
    expect(applied.every((v) => typeof v === "number")).toBe(true);
    expect(window[6].extra.SAAH).toBe(undefined);

    const sum = applied.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum * 100 - first.effectPct) < 1e-9).toBe(true);
  });

  test("같은 시드면 같은 뉴스, 같은 시점", () => {
    const a = play(new NewsEngine({ codes: ALL, seed: 42 })).emitted;
    const b = play(new NewsEngine({ codes: ALL, seed: 42 })).emitted;
    expect(a).toEqual(b);
  });

  test("발행 메시지 형식: t, stock, headline, effectPct", () => {
    const { emitted } = play(new NewsEngine({ codes: ALL, seed: 5 }));
    expect(Object.keys(emitted[0]).sort()).toEqual(["effectPct", "headline", "stock", "t"]);
  });
});
