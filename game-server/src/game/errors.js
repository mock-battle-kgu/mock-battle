// 요청이 규칙에 어긋날 때 던지는 오류. code는 docs/protocol.md 5장의 오류 코드
class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

module.exports = { GameError };
