// 연습 모드: 실제 과거 일봉을 하루 = 틱 5개(5초)로 재생 (가이드 4-4)
// 게임 서버가 틱 5개를 캔들 하나로 묶으므로, 화면의 캔들 하나 = 실제 일봉 하나
const fs = require("fs");
const path = require("path");
const config = require("../config");

const TICKS_PER_DAY = 5;
// 실제 종목을 숨기기 위해 연습 모드는 종목 코드 하나만 사용 (protocol.md 1장)
const PRACTICE_CODE = "STOCK_A";

// scenarios/의 CSV(date,open,high,low,close)를 읽음
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((s) => s.trim());
  const col = (name) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`CSV에 ${name} 열이 없음`);
    return i;
  };
  const cols = { date: col("date"), open: col("open"), high: col("high"), low: col("low"), close: col("close") };

  return lines.slice(1).map((line, n) => {
    const cells = line.split(",");
    const day = { date: cells[cols.date] };
    for (const key of ["open", "high", "low", "close"]) {
      day[key] = Number(cells[cols[key]]);
      if (!Number.isFinite(day[key]) || day[key] <= 0) {
        throw new Error(`CSV ${n + 2}번째 줄의 ${key} 값이 잘못됨`);
      }
    }
    return day;
  });
}

// 하루를 틱 5개로: 상승일 시가→저가→고가→종가→종가, 하락일 시가→고가→저가→종가→종가
function dayTicks({ open, high, low, close }) {
  return close >= open
    ? [open, low, high, close, close]
    : [open, high, low, close, close];
}

class Replay {
  /**
   * @param {Array} days 거래일 목록
   * @param {object|null} scenario index.json의 시나리오 정보 (firstClose, fundamentals 등)
   */
  constructor(days, scenario = null) {
    if (!days.length) throw new Error("재생할 거래일이 없음");
    this.days = days;
    this.ticks = days.flatMap(dayTicks);
    this.scenario = scenario;
  }

  // index.json에서 scenarioId를 찾아 CSV를 불러옴
  static load(scenarioId, dir = config.scenarioDir) {
    const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
    const scenario = index.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error(`없는 시나리오: ${scenarioId}`);
    const days = parseCsv(fs.readFileSync(path.join(dir, scenario.file), "utf8"));
    return new Replay(days, scenario);
  }

  // t=0은 첫날 시가(시작가), t=1부터 하루에 틱 5개씩
  // 데이터가 끝나면 마지막 종가를 유지
  priceAt(t) {
    if (t <= 0) return this.days[0].open;
    return this.ticks[Math.min(t, this.ticks.length) - 1];
  }
}

module.exports = { Replay, dayTicks, parseCsv, PRACTICE_CODE, TICKS_PER_DAY };
