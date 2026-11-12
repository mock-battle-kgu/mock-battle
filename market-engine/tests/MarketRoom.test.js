const MarketRoom = require("../src/MarketRoom");

function createRoom(overrides = {}) {
  const ticks = [];
  const onEnd = jest.fn();
  const room = new MarketRoom(
    { roomId: "482913", mode: "battle", durationSec: 5, stocks: ["GANA"], ...overrides },
    { tickMs: 1000, onTick: (r) => ticks.push(r.t), onEnd }
  );
  return { room, ticks, onEnd };
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
});
