const MarketRoom = require("../src/MarketRoom");

function createRoom(overrides = {}) {
  const ticks = [];
  const prices = [];
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
    }
  );
  return { room, ticks, prices, onEnd };
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
});
