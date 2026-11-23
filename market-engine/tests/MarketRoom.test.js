const MarketRoom = require("../src/MarketRoom");
const { Replay } = require("../src/model/Replay");

function createRoom(overrides = {}) {
  const ticks = [];
  const prices = [];
  const news = [];
  const onEnd = jest.fn();
  const room = new MarketRoom(
    { roomId: "482913", mode: "battle", durationSec: 5, stocks: ["GANA"], ...overrides },
    {
      tickMs: 1000,
      onTick: (r) => {
        ticks.push(r.t);
        prices.push({ ...r.prices });
      },
      onEnd,
      onNews: (r, n) => news.push({ ...n, pricesAtNews: { ...r.prices } }),
    }
  );
  return { room, ticks, prices, news, onEnd };
}

describe("MarketRoom", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("start하면 t=0 틱이 바로 나감", () => {
    const { room, ticks } = createRoom();
    room.start();
    expect(ticks).toEqual([0]);
    expect(room.running).toBe(true);
  });

  test("1초마다 t가 1씩 증가", () => {
    const { room, ticks } = createRoom();
    room.start();
    jest.advanceTimersByTime(3000);
    expect(ticks).toEqual([0, 1, 2, 3]);
  });

  test("durationSec가 되면 스스로 멈추고 onEnd를 한 번 호출", () => {
    const { room, ticks, onEnd } = createRoom({ durationSec: 3 });
    room.start();
    jest.advanceTimersByTime(10000);
    expect(ticks).toEqual([0, 1, 2, 3]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(room.running).toBe(false);
  });

  test("stop 후에는 틱이 나가지 않음", () => {
    const { room, ticks } = createRoom();
    room.start();
    jest.advanceTimersByTime(2000);
    room.stop();
    jest.advanceTimersByTime(5000);
    expect(ticks).toEqual([0, 1, 2]);
    expect(room.running).toBe(false);
  });

  test("대결 모드: t=0 틱에 시작가가 들어 있음", () => {
    const { room, prices } = createRoom({ stocks: ["GANA", "DARA"] });
    room.start();
    expect(prices[0]).toEqual({ GANA: 46000, DARA: 19000 });
  });

  test("대결 모드: 틱마다 가격이 바뀜", () => {
    const { room, prices } = createRoom({ stocks: ["MABA"], durationSec: 600, seed: 3 });
    room.start();
    jest.advanceTimersByTime(30000);
    const values = new Set(prices.map((p) => p.MABA));
    expect(values.size > 1).toBe(true);
  });

  test("방 2개가 같은 시드면 같은 가격, 서로 영향 없음", () => {
    const a = createRoom({ roomId: "111111", stocks: ["GANA"], durationSec: 600, seed: 9 });
    const b = createRoom({ roomId: "222222", stocks: ["GANA"], durationSec: 600, seed: 9 });
    a.room.start();
    b.room.start();
    jest.advanceTimersByTime(5000);
    b.room.stop();
    jest.advanceTimersByTime(5000);
    expect(b.prices).toEqual(a.prices.slice(0, b.prices.length));
    expect(a.prices.length).toBe(11);
  });

  test("연습 모드: STOCK_A 하나로 과거 주가 재생, t=0은 첫날 시가", () => {
    const replay = Replay.load("covid-2020");
    const { room, prices } = createRoom({ mode: "practice", stocks: [], scenarioId: "covid-2020", durationSec: 600 });
    room.start();
    jest.advanceTimersByTime(10000);
    expect(Object.keys(prices[0])).toEqual(["STOCK_A"]);
    expect(prices[0].STOCK_A).toBe(replay.days[0].open);
    expect(prices.map((p) => p.STOCK_A)).toEqual(
      Array.from({ length: 11 }, (_, t) => replay.priceAt(t))
    );
  });

  test("연습 모드: 없는 시나리오면 방을 만들 수 없음", () => {
    expect(() => createRoom({ mode: "practice", stocks: [], scenarioId: "nope" })).toThrow();
  });

  test("대결 모드: 10분 동안 뉴스가 7~12개 발행됨", () => {
    const { room, news } = createRoom({ stocks: ["GANA", "DARA", "MABA"], durationSec: 600, seed: 8 });
    room.start();
    jest.advanceTimersByTime(600000);
    expect(news.length >= 7 && news.length <= 12).toBe(true);
    expect(news.every((n) => typeof n.headline === "string")).toBe(true);
  });

  test("대결 모드: 큰 호재 뉴스 뒤 5틱 동안 해당 종목이 뉴스 없을 때보다 오름", () => {
    // 같은 시드로 뉴스 없는 가격 흐름과 비교
    const PriceModel = require("../src/model/PriceModel");
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const { room, prices, news } = createRoom({ stocks: ["SAAH"], durationSec: 600, seed });
      room.start();
      jest.advanceTimersByTime(600000);
      const good = news.find((n) => n.effectPct >= 4);
      if (!good) continue;

      const base = new PriceModel({ codes: ["SAAH"], seed, fundamentals: room.fundamentals });
      const baseHistory = [base.snapshot()];
      for (let t = 1; t <= 600; t++) baseHistory.push(base.step());

      // 뉴스 이전 효과까지 포함되어 있으므로 "뉴스 5틱 동안의 상승폭"을 비교
      const t0 = good.t;
      const withNews = prices[t0 + 5].SAAH / prices[t0].SAAH;
      const without = baseHistory[t0 + 5].SAAH / baseHistory[t0].SAAH;
      expect(withNews > without).toBe(true);
      return;
    }
    throw new Error("테스트할 호재 뉴스를 찾지 못함");
  });

  test("연습 모드: 뉴스가 발행되지 않음", () => {
    const { room, news } = createRoom({ mode: "practice", stocks: [], scenarioId: "covid-2020", durationSec: 600 });
    room.start();
    jest.advanceTimersByTime(600000);
    expect(news.length).toBe(0);
  });

  test("대결 모드: 모두 같은 종목을 계속 사면 가격이 오름", () => {
    const seed = 21;
    const buyer = createRoom({ stocks: ["GANA"], durationSec: 600, seed });
    const base = createRoom({ stocks: ["GANA"], durationSec: 600, seed });
    buyer.room.start();
    base.room.start();
    for (let t = 1; t <= 30; t++) {
      buyer.room.addFlow(t, { GANA: 800 }); // 1초마다 800주 순매수
      jest.advanceTimersByTime(1000);
    }
    expect(buyer.prices[30].GANA > base.prices[30].GANA).toBe(true);
    expect(buyer.room.impactPct.GANA).toBe(3); // 10초 합 8000주 → 상한 3%
  });

  test("대결 모드: 순매수가 없으면 impactPct는 0", () => {
    const { room } = createRoom({ stocks: ["GANA", "DARA"], durationSec: 600, seed: 4 });
    room.start();
    jest.advanceTimersByTime(5000);
    expect(room.impactPct).toEqual({ GANA: 0, DARA: 0 });
  });

  test("연습 모드: flow를 받아도 무시하고 impactPct는 0", () => {
    const { room } = createRoom({ mode: "practice", stocks: [], scenarioId: "covid-2020", durationSec: 600 });
    room.start();
    expect(room.addFlow(1, { STOCK_A: 1000 })).toBe(false);
    jest.advanceTimersByTime(3000);
    expect(room.impactPct).toEqual({ STOCK_A: 0 });
  });

  test("대결 모드: 판마다 종목 지표가 생기고 sector·eps·bps·sectorPer가 있음", () => {
    const { room } = createRoom({ stocks: ["GANA", "DARA"], seed: 3 });
    expect(Object.keys(room.fundamentals)).toEqual(["GANA", "DARA"]);
    for (const code of ["GANA", "DARA"]) {
      const f = room.fundamentals[code];
      expect(["sector", "eps", "bps", "sectorPer"].every((k) => k in f)).toBe(true);
    }
  });

  test("대결 모드: 같은 시드면 같은 지표, 다른 시드면 다를 수 있음", () => {
    const a = createRoom({ stocks: ["GANA"], seed: 5 }).room.fundamentals;
    const b = createRoom({ stocks: ["GANA"], seed: 5 }).room.fundamentals;
    expect(a).toEqual(b);
  });

  test("연습 모드: 지표에 sector가 없음 (시나리오에 지표가 없으면 null)", () => {
    const { room } = createRoom({ mode: "practice", stocks: [], scenarioId: "covid-2020" });
    if (room.fundamentals !== null) {
      expect(Object.keys(room.fundamentals)).toEqual(["STOCK_A"]);
      expect(room.fundamentals.STOCK_A.sector).toBe(undefined);
    }
  });

  test("대결 모드: 매 틱 종목별 거래량이 있고 t=0은 0", () => {
    const { room } = createRoom({ stocks: ["GANA", "DARA"], seed: 2 });
    expect(room.volumes).toEqual({ GANA: 0, DARA: 0 });
    room.start();
    jest.advanceTimersByTime(3000);
    expect(room.volumes.GANA > 0 && room.volumes.DARA > 0).toBe(true);
  });

  test("거래량을 추가해도 같은 시드의 가격은 그대로", () => {
    const PriceModel = require("../src/model/PriceModel");
    const { room, prices } = createRoom({ stocks: ["GANA"], seed: 13, durationSec: 600 });
    room.start();
    jest.advanceTimersByTime(30000);
    // 뉴스(첫 뉴스는 40초 이후)·순매수가 없는 30초 동안은 PriceModel과 같아야 함
    const base = new PriceModel({ codes: ["GANA"], seed: 13, fundamentals: room.fundamentals });
    const expected = [base.snapshot()];
    for (let t = 1; t <= 30; t++) expected.push(base.step());
    expect(prices.slice(0, 31)).toEqual(expected);
  });

  test("연습 모드: STOCK_A 거래량이 재생됨", () => {
    const { room } = createRoom({ mode: "practice", stocks: [], scenarioId: "covid-2020", durationSec: 600 });
    expect(room.volumes).toEqual({ STOCK_A: 0 });
    room.start();
    jest.advanceTimersByTime(5000);
    expect(room.volumes.STOCK_A).toBe(room.replay.volumeAt(5));
  });
});
