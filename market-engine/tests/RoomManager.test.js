const RoomManager = require("../src/RoomManager");

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

function createManager() {
  const ticks = [];
  const manager = new RoomManager({
    tickMs: 1000,
    logger: silentLogger,
    onTick: (room) => ticks.push({ roomId: room.roomId, t: room.t }),
  });
  return { manager, ticks };
}

const battleStart = (roomId) => ({
  type: "start",
  roomId,
  mode: "battle",
  durationSec: 600,
  stocks: ["GANA", "DARA"],
});

describe("RoomManager", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("start 메시지 하나에 방 하나가 생김", () => {
    const { manager } = createManager();
    manager.handleControl(battleStart("482913"));
    expect(manager.rooms.size).toBe(1);
    expect(manager.rooms.has("482913")).toBe(true);
  });

  test("연습 모드는 scenarioId로 시작", () => {
    const { manager } = createManager();
    manager.handleControl({
      type: "start",
      roomId: "771205",
      mode: "practice",
      durationSec: 600,
      scenarioId: "covid-2020",
    });
    expect(manager.rooms.get("771205").scenarioId).toBe("covid-2020");
  });

  test("같은 방에 start가 두 번 와도 방은 하나", () => {
    const { manager } = createManager();
    manager.handleControl(battleStart("482913"));
    manager.handleControl(battleStart("482913"));
    expect(manager.rooms.size).toBe(1);
  });

  test("stop 메시지로 방이 없어지고 틱도 멈춤", () => {
    const { manager, ticks } = createManager();
    manager.handleControl(battleStart("482913"));
    jest.advanceTimersByTime(2000);
    manager.handleControl({ type: "stop", roomId: "482913" });
    jest.advanceTimersByTime(5000);
    expect(manager.rooms.size).toBe(0);
    expect(ticks.length).toBe(3); // t = 0, 1, 2
  });

  test("방 2개가 서로 섞이지 않음", () => {
    const { manager, ticks } = createManager();
    manager.handleControl(battleStart("111111"));
    manager.handleControl(battleStart("222222"));
    jest.advanceTimersByTime(1000);
    manager.handleControl({ type: "stop", roomId: "111111" });
    jest.advanceTimersByTime(2000);

    const roomA = ticks.filter((x) => x.roomId === "111111").map((x) => x.t);
    const roomB = ticks.filter((x) => x.roomId === "222222").map((x) => x.t);
    expect(roomA).toEqual([0, 1]);
    expect(roomB).toEqual([0, 1, 2, 3]);
    expect(manager.rooms.size).toBe(1);
  });

  test("시간이 다 된 방은 목록에서 빠짐", () => {
    const { manager } = createManager();
    manager.handleControl({ ...battleStart("482913"), durationSec: 3 });
    jest.advanceTimersByTime(3000);
    expect(manager.rooms.size).toBe(0);
  });

  test("형식이 틀린 start는 무시", () => {
    const { manager } = createManager();
    manager.handleControl({ type: "start", roomId: "1", mode: "solo", durationSec: 600, stocks: ["GANA"] });
    manager.handleControl({ type: "start", roomId: "2", mode: "battle", durationSec: 600 });
    manager.handleControl({ type: "start", roomId: "3", mode: "practice", durationSec: 600 });
    manager.handleControl({ type: "start", roomId: "4", mode: "battle", durationSec: -1, stocks: ["GANA"] });
    expect(manager.rooms.size).toBe(0);
  });

  test("없는 방 stop, 알 수 없는 type은 오류 없이 무시", () => {
    const { manager } = createManager();
    expect(() => manager.handleControl({ type: "stop", roomId: "999999" })).not.toThrow();
    expect(() => manager.handleControl({ type: "pause", roomId: "482913" })).not.toThrow();
    expect(() => manager.handleControl(null)).not.toThrow();
  });

  test("stopAll로 모든 방 정리", () => {
    const { manager } = createManager();
    manager.handleControl(battleStart("111111"));
    manager.handleControl(battleStart("222222"));
    manager.stopAll();
    expect(manager.rooms.size).toBe(0);
  });
});
