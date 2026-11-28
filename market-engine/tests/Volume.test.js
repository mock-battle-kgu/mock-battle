const fs = require("fs");
const os = require("os");
const path = require("path");
const VolumeModel = require("../src/model/VolumeModel");
const PriceModel = require("../src/model/PriceModel");
const { Replay, parseCsv, TICKS_PER_DAY } = require("../src/model/Replay");
const STOCKS = require("../src/data/stocks.json");

const ALL = Object.keys(STOCKS);

describe("Volume (대결 모드)", () => {
  test("거래량은 0 이상 정수", () => {
    const prices = new PriceModel({ codes: ALL, seed: 1 });
    const volume = new VolumeModel({ codes: ALL, seed: 3 });
    let before = prices.snapshot();
    for (let t = 0; t < 600; t++) {
      const after = prices.step();
      const v = volume.step(before, after);
      for (const code of ALL) {
        expect(Number.isInteger(v[code]) && v[code] >= 0).toBe(true);
      }
      before = after;
    }
  });

  test("기본 거래량은 1초 약 1,000만 원어치 (GANA 약 217주)", () => {
    const volume = new VolumeModel({ codes: ["GANA"], seed: 9 });
    const same = { GANA: 46000 };
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += volume.step(same, same).GANA;
    const avg = sum / 2000;
    expect(avg > 180 && avg < 260).toBe(true);
  });

  test("변동이 큰 틱일수록 평균 거래량이 큼", () => {
    const calm = new VolumeModel({ codes: ["GANA"], seed: 4 });
    const busy = new VolumeModel({ codes: ["GANA"], seed: 4 });
    let calmSum = 0;
    let busySum = 0;
    for (let i = 0; i < 500; i++) {
      calmSum += calm.step({ GANA: 46000 }, { GANA: 46000 }).GANA;
      busySum += busy.step({ GANA: 46000 }, { GANA: 46000 * 1.01 }).GANA;
    }
    expect(busySum > calmSum * 2).toBe(true);
  });

  test("같은 시드면 같은 거래량", () => {
    const a = new VolumeModel({ codes: ALL, seed: 5 });
    const b = new VolumeModel({ codes: ALL, seed: 5 });
    const p = Object.fromEntries(ALL.map((c) => [c, STOCKS[c].startPrice]));
    for (let i = 0; i < 50; i++) expect(a.step(p, p)).toEqual(b.step(p, p));
  });
});

describe("Volume (연습 모드)", () => {
  const CSV = [
    "date,open,high,low,close,volume",
    "2020-01-02,10050,10200,9900,10000,100003",
    "2020-01-03,10000,10300,9950,10250,250000",
  ].join("\n");

  function load(csv) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scenarios-"));
    fs.writeFileSync(path.join(dir, "s.csv"), csv);
    fs.writeFileSync(
      path.join(dir, "index.json"),
      JSON.stringify({ scenarios: [{ id: "s", file: "s.csv" }] })
    );
    return Replay.load("s", dir);
  }

  test("틱 5개의 합 = 그날 거래량, 나머지는 마지막 틱에", () => {
    const replay = load(CSV);
    const day1 = [1, 2, 3, 4, 5].map((t) => replay.volumeAt(t));
    expect(day1).toEqual([20000, 20000, 20000, 20000, 20003]);
    const day2 = [6, 7, 8, 9, 10].map((t) => replay.volumeAt(t));
    expect(day2.reduce((s, v) => s + v, 0)).toBe(250000);
  });

  test("t=0과 데이터가 끝난 뒤는 0", () => {
    const replay = load(CSV);
    expect(replay.volumeAt(0)).toBe(0);
    expect(replay.volumeAt(2 * TICKS_PER_DAY + 1)).toBe(0);
  });

  test("volume 열이 없는 예전 CSV는 거래량 0", () => {
    const days = parseCsv("date,open,high,low,close\n2020-01-02,1,1,1,1");
    expect(days[0].volume).toBe(0);
  });

  test("scenarios/의 시나리오는 하루 거래량 = 틱 5개 합", () => {
    const index = JSON.parse(
      fs.readFileSync(path.join(require("../src/config").scenarioDir, "index.json"), "utf8")
    );
    for (const s of index.scenarios) {
      const replay = Replay.load(s.id);
      replay.days.forEach((day, i) => {
        let sum = 0;
        for (let k = 1; k <= TICKS_PER_DAY; k++) sum += replay.volumeAt(i * TICKS_PER_DAY + k);
        expect(sum).toBe(day.volume);
      });
    }
  });
});
