// market.control 메시지를 받아 방별 MarketRoom을 만들고 없앰
const MarketRoom = require("./MarketRoom");
const STOCKS = require("./data/stocks.json");

const MODES = ["battle", "practice"];

// start 메시지가 protocol.md 3장 형식에 맞는지 확인
function validateStart(msg) {
  if (typeof msg.roomId !== "string" || msg.roomId === "") return "roomId 없음";
  if (!MODES.includes(msg.mode)) return "mode가 battle/practice가 아님";
  if (!Number.isInteger(msg.durationSec) || msg.durationSec <= 0) {
    return "durationSec가 양의 정수가 아님";
  }
  if (msg.mode === "battle" && (!Array.isArray(msg.stocks) || msg.stocks.length === 0)) {
    return "대결 모드에 stocks 없음";
  }
  if (msg.mode === "battle" && msg.stocks.some((code) => !STOCKS[code])) {
    return "알 수 없는 종목 코드";
  }
  if (msg.mode === "practice" && typeof msg.scenarioId !== "string") {
    return "연습 모드에 scenarioId 없음";
  }
  return null;
}

class RoomManager {
  /**
   * @param {object} options tickMs, logger, onTick(room), onNews(room, news)
   */
  constructor({ tickMs, logger, onTick, onNews }) {
    this.tickMs = tickMs;
    this.logger = logger;
    this.onTick = onTick || (() => {});
    this.onNews = onNews || (() => {});
    this.rooms = new Map();
  }

  handleControl(msg) {
    if (!msg || typeof msg !== "object") {
      this.logger.warn("control 메시지 형식 오류");
      return;
    }
    if (msg.type === "start") return this.startRoom(msg);
    if (msg.type === "stop") return this.stopRoom(msg.roomId);
    this.logger.warn({ type: msg.type }, "알 수 없는 control type");
  }

  startRoom(msg) {
    const error = validateStart(msg);
    if (error) {
      this.logger.warn({ roomId: msg.roomId, error }, "start 메시지 무시");
      return;
    }
    if (this.rooms.has(msg.roomId)) {
      this.logger.warn({ roomId: msg.roomId }, "이미 시작된 방, start 무시");
      return;
    }

    let room;
    try {
      room = new MarketRoom(msg, {
        tickMs: this.tickMs,
        onTick: (r) => this.onTick(r),
        onNews: (r, news) => this.onNews(r, news),
        onEnd: (r) => {
          this.rooms.delete(r.roomId);
          this.logger.info({ roomId: r.roomId }, "시간 종료로 방 시장 종료");
        },
      });
    } catch (err) {
      // 예: 없는 scenarioId, 시나리오 파일 오류
      this.logger.warn({ roomId: msg.roomId, error: err.message }, "방 시장을 만들 수 없음, start 무시");
      return;
    }
    this.rooms.set(msg.roomId, room);
    this.logger.info(
      { roomId: msg.roomId, mode: msg.mode, seed: room.seed, rooms: this.rooms.size },
      "방 시장 시작"
    );
    room.start();
  }

  // market.flow: { roomId, t, netQty } → 해당 방에 전달
  handleFlow(msg) {
    if (!msg || typeof msg !== "object") return;
    const room = this.rooms.get(msg.roomId);
    if (!room) return; // 끝난 방이나 없는 방의 flow는 조용히 무시
    if (!room.addFlow(msg.t, msg.netQty)) {
      this.logger.debug({ roomId: msg.roomId }, "flow 무시 (연습 모드이거나 형식 오류)");
    }
  }

  stopRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn({ roomId }, "없는 방, stop 무시");
      return;
    }
    room.stop();
    this.rooms.delete(roomId);
    this.logger.info({ roomId, rooms: this.rooms.size }, "방 시장 종료");
  }

  stopAll() {
    for (const room of this.rooms.values()) room.stop();
    this.rooms.clear();
  }
}

module.exports = RoomManager;
