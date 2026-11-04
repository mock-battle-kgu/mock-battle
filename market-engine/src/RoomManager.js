// market.control 메시지를 받아 방별 MarketRoom을 만들고 없앰
const MarketRoom = require("./MarketRoom");

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
  if (msg.mode === "practice" && typeof msg.scenarioId !== "string") {
    return "연습 모드에 scenarioId 없음";
  }
  return null;
}

class RoomManager {
  /**
   * @param {object} options tickMs, logger, onTick(room)
   */
  constructor({ tickMs, logger, onTick }) {
    this.tickMs = tickMs;
    this.logger = logger;
    this.onTick = onTick || (() => {});
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

    const room = new MarketRoom(msg, {
      tickMs: this.tickMs,
      onTick: (r) => this.onTick(r),
      onEnd: (r) => {
        this.rooms.delete(r.roomId);
        this.logger.info({ roomId: r.roomId }, "시간 종료로 방 시장 종료");
      },
    });
    this.rooms.set(msg.roomId, room);
    this.logger.info(
      { roomId: msg.roomId, mode: msg.mode, rooms: this.rooms.size },
      "방 시장 시작"
    );
    room.start();
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
