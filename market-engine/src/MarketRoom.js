// 방 하나의 시장: 1초마다 가격을 만들고, 시간이 다 되면 스스로 멈춤
const PriceModel = require("./model/PriceModel");
const { randomSeed } = require("./model/random");

class MarketRoom {
  /**
   * @param {object} settings market.control start 메시지 내용 (seed는 테스트용)
   * @param {object} options tickMs, onTick(room), onEnd(room)
   */
  constructor(settings, { tickMs, onTick, onEnd }) {
    this.roomId = settings.roomId;
    this.mode = settings.mode;
    this.durationSec = settings.durationSec;
    this.stocks = settings.stocks || [];
    this.scenarioId = settings.scenarioId || null;
    this.seed = settings.seed ?? randomSeed();

    this.tickMs = tickMs;
    this.onTick = onTick;
    this.onEnd = onEnd;

    // 대결 모드만 가격 모델 사용 (연습 모드 재생은 E단계)
    this.model =
      this.mode === "battle"
        ? new PriceModel({ codes: this.stocks, seed: this.seed })
        : null;
    this.prices = this.model ? this.model.snapshot() : {};

    this.t = 0;
    this.timer = null;
  }

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.running) return;
    this.t = 0;
    // t=0 틱(시작가)을 바로 보내 게임 서버가 game:start에 쓸 수 있게 함
    this.onTick(this);
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  tick() {
    this.t += 1;
    if (this.model) this.prices = this.model.step();
    this.onTick(this);
    if (this.t >= this.durationSec) {
      this.stop();
      this.onEnd(this);
    }
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = MarketRoom;
