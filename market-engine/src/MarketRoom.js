// 방 하나의 시장: 1초마다 가격을 만들고(대결) 또는 재생하고(연습), 시간이 다 되면 스스로 멈춤
const PriceModel = require("./model/PriceModel");
const { randomSeed } = require("./model/random");
const { Replay, PRACTICE_CODE } = require("./model/Replay");
const NewsEngine = require("./model/NewsEngine");
const FlowImpact = require("./model/FlowImpact");

class MarketRoom {
  /**
   * @param {object} settings market.control start 메시지 내용 (seed는 테스트용)
   * @param {object} options tickMs, onTick(room), onEnd(room), onNews(room, news)
   */
  constructor(settings, { tickMs, onTick, onEnd, onNews = () => {} }) {
    this.roomId = settings.roomId;
    this.mode = settings.mode;
    this.durationSec = settings.durationSec;
    this.stocks = settings.stocks || [];
    this.scenarioId = settings.scenarioId || null;
    this.seed = settings.seed ?? randomSeed();

    this.tickMs = tickMs;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.onNews = onNews;

    this.t = 0;
    this.timer = null;

    // 대결 모드는 가격 모델, 연습 모드는 과거 주가 재생
    // 시나리오 파일이 없으면 여기서 오류가 나고, RoomManager가 방을 만들지 않음
    this.model = null;
    this.news = null;
    this.flow = null;
    this.replay = null;
    if (this.mode === "battle") {
      this.model = new PriceModel({ codes: this.stocks, seed: this.seed });
      // 가격과 다른 난수 흐름을 써서, 뉴스가 있어도 기본 가격 움직임은 시드대로 유지
      this.news = new NewsEngine({ codes: this.stocks, seed: (this.seed ^ 0x9e3779b9) >>> 0 });
      this.flow = new FlowImpact({ codes: this.stocks });
    } else if (this.mode === "practice") {
      this.replay = Replay.load(this.scenarioId);
    }
    this.prices = this.currentPrices();
    this.impactPct = this.zeroImpact();
  }

  zeroImpact() {
    return Object.fromEntries(Object.keys(this.prices).map((code) => [code, 0]));
  }

  // market.flow 수신 (대결 모드만, 연습 모드는 무시)
  addFlow(t, netQty) {
    return this.flow ? this.flow.add(t, netQty) : false;
  }

  currentPrices() {
    if (this.model) return this.model.snapshot();
    if (this.replay) return { [PRACTICE_CODE]: this.replay.priceAt(this.t) };
    return {};
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
    if (this.model) {
      // 1) 이전에 나온 뉴스 효과 + 플레이어 순매수 영향을 이번 가격에 반영
      const extra = this.news.effectsAt(this.t);
      this.impactPct = this.flow.impactAt(this.t);
      const flowExtra = this.flow.extraFrom(this.impactPct);
      for (const code in flowExtra) extra[code] = (extra[code] || 0) + flowExtra[code];
      this.prices = this.model.step(extra);
    } else {
      this.prices = this.currentPrices();
    }
    // 2) 새 뉴스는 이번 틱보다 먼저 발행 → 가격에는 다음 틱부터 반영
    const news = this.news ? this.news.emit(this.t, this.durationSec) : null;
    if (news) this.onNews(this, news);
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
