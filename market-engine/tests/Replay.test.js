const fs = require("fs");
const os = require("os");
const path = require("path");
const { Replay, dayTicks, parseCsv, TICKS_PER_DAY } = require("../src/model/Replay");
const config = require("../src/config");

// 틱 5개씩 묶어 캔들로 다시 만들기 (게임 서버가 하는 방식)
function toCandles(ticks) {
  const candles = [];
  for (let i = 0; i < ticks.length; i += TICKS_PER_DAY) {
    const group = ticks.slice(i, i + TICKS_PER_DAY);
    candles.push({
      open: group[0],
      high: Math.max(...group),
      low: Math.min(...group),
      close: group[group.length - 1],
    });
  }
  return candles;
}

const SAMPLE_CSV = [
  "date,open,high,low,close",
  "2020-01-02,10050,10200,9900,10000", // 하락일
  "2020-01-03,10000,10300,9950,10250", // 상승일
  "2020-01-06,10250,10250,10100,10250", // 보합 (상승일로 처리)
].join("\n");

function makeScenarioDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scenarios-"));
  fs.writeFileSync(path.join(dir, "sample.csv"), SAMPLE_CSV);
  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ scenarios: [{ id: "sample", file: "sample.csv", name: "테스트", period: "2020-01 ~ 2020-01" }] })
  );
  return dir;
}

describe("Replay", () => {
  test("상승일: 시가 → 저가 → 고가 → 종가 → 종가", () => {
    expect(dayTicks({ open: 100, high: 130, low: 90, close: 120 })).toEqual([100, 90, 130, 120, 120]);
  });

  test("하락일: 시가 → 고가 → 저가 → 종가 → 종가", () => {
    expect(dayTicks({ open: 120, high: 130, low: 90, close: 100 })).toEqual([120, 130, 90, 100, 100]);
  });

  test("CSV를 읽어 거래일 목록으로 바꿈", () => {
    const days = parseCsv(SAMPLE_CSV);
    expect(days.length).toBe(3);
    // volume 열이 없는 CSV라 거래량은 0
    expect(days[1]).toEqual({ date: "2020-01-03", open: 10000, high: 10300, low: 9950, close: 10250, volume: 0 });
  });

  test("값이 잘못된 CSV는 오류", () => {
    expect(() => parseCsv("date,open,high,low,close\n2020-01-02,abc,1,1,1")).toThrow();
  });

  test("하루 = 틱 5개, t=0은 첫날 시가", () => {
    const replay = Replay.load("sample", makeScenarioDir());
    expect(replay.ticks.length).toBe(15);
    expect(replay.priceAt(0)).toBe(10050);
    const day1 = [1, 2, 3, 4, 5].map((t) => replay.priceAt(t));
    expect(day1).toEqual([10050, 10200, 9900, 10000, 10000]);
  });

  test("틱 5개로 다시 만든 캔들이 원래 일봉과 같음", () => {
    const replay = Replay.load("sample", makeScenarioDir());
    const candles = toCandles(replay.ticks);
    expect(candles).toEqual(replay.days.map(({ open, high, low, close }) => ({ open, high, low, close })));
  });

  test("데이터가 끝나면 마지막 종가 유지", () => {
    const replay = Replay.load("sample", makeScenarioDir());
    expect(replay.priceAt(15)).toBe(10250);
    expect(replay.priceAt(100)).toBe(10250);
  });

  test("없는 시나리오는 오류", () => {
    expect(() => Replay.load("nope", makeScenarioDir())).toThrow();
  });

  // 저장소의 실제 시나리오 파일 검사 (시나리오를 고치면 이 테스트가 다시 확인)
  test("scenarios/의 모든 시나리오가 120거래일, 600틱, 첫 종가 10,000원, 캔들 일치", () => {
    const index = JSON.parse(fs.readFileSync(path.join(config.scenarioDir, "index.json"), "utf8"));
    expect(index.scenarios.length >= 3).toBe(true);
    for (const s of index.scenarios) {
      const replay = Replay.load(s.id);
      expect(replay.days.length).toBe(120);
      expect(replay.ticks.length).toBe(600);
      expect(replay.days[0].close).toBe(10000);
      const candles = toCandles(replay.ticks);
      expect(candles).toEqual(replay.days.map(({ open, high, low, close }) => ({ open, high, low, close })));
    }
  });
});
