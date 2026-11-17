// 방 하나의 시장: 1초마다 틱을 만들고, 시간이 다 되면 스스로 멈춤
// 가격 계산과 market.tick 발행은 C단계에서 onTick에 연결합니다.

class MarketRoom {
  /**
   * @param {object} settings market.control start 메시지 내용
   * @param {object} options tickMs, onTick(room), onEnd(room)
   */
  constructor(settings, { tickMs, onTick, onEnd }) {
    this.roomId = settings.roomId;
    this.mode = settings.mode;
    this.durationSec = settings.durationSec;
    this.stocks = settings.stocks || [];
    this.scenarioId = settings.scenarioId || null;

    this.tickMs = tickMs;
    this.onTick = onTick;
    this.onEnd = onEnd;

    this.t = 0;
    this.timer = null;
  }

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.running) return;
    this.t = 0;
    // t=0 틱을 바로 보내 게임 서버가 시작가를 받을 수 있게 함
    this.onTick(this);
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  tick() {
    this.t += 1;
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
