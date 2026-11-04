// 시세 엔진과 RabbitMQ로 메시지를 주고받는다 (docs/protocol.md 3장)
const amqp = require('amqplib');

const EXCHANGE = 'market';
const KEYS = {
  control: 'market.control', // 게임 서버 → 시세 엔진: 시장 시작·종료
  flow: 'market.flow',       // 게임 서버 → 시세 엔진: 순매수량
  tick: 'market.tick',       // 시세 엔진 → 게임 서버: 가격
  news: 'market.news',       // 시세 엔진 → 게임 서버: 진짜 뉴스
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class MarketClient {
  constructor({ url, logger, connectFn = amqp.connect, retries = 5, retryDelayMs = 3000 } = {}) {
    this.url = url;
    this.logger = logger;
    this.connectFn = connectFn;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
    this.handlers = { tick: [], news: [] };
    this.connection = null;
    this.channel = null;
  }

  // RabbitMQ가 늦게 뜰 수 있어서 실패하면 retryDelayMs 간격으로 다시 시도
  async connect() {
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        this.connection = await this.connectFn(this.url);
        break;
      } catch (err) {
        this.logger?.warn({ attempt, err: err.message }, 'RabbitMQ connect failed');
        if (attempt === this.retries) throw err;
        await sleep(this.retryDelayMs);
      }
    }

    this.connection.on('close', () => this.logger?.error('RabbitMQ connection closed'));

    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    // 게임 서버 전용 임시 큐에 tick, news만 받아온다
    const { queue } = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue, EXCHANGE, KEYS.tick);
    await this.channel.bindQueue(queue, EXCHANGE, KEYS.news);
    await this.channel.consume(queue, (msg) => this.dispatch(msg), { noAck: true });

    this.logger?.info({ exchange: EXCHANGE }, 'RabbitMQ connected');
  }

  dispatch(msg) {
    if (!msg) return;
    let body;
    try {
      body = JSON.parse(msg.content.toString());
    } catch {
      this.logger?.warn({ key: msg.fields.routingKey }, 'invalid JSON from market');
      return;
    }
    const key = msg.fields.routingKey;
    const type = key === KEYS.tick ? 'tick' : key === KEYS.news ? 'news' : null;
    if (!type) return;
    for (const handler of this.handlers[type]) handler(body);
  }

  onTick(handler) {
    this.handlers.tick.push(handler);
  }

  onNews(handler) {
    this.handlers.news.push(handler);
  }

  publishControl(message) {
    this.publish(KEYS.control, message);
  }

  publishFlow(message) {
    this.publish(KEYS.flow, message);
  }

  publish(key, message) {
    if (!this.channel) throw new Error('MarketClient is not connected');
    this.channel.publish(EXCHANGE, key, Buffer.from(JSON.stringify(message)), {
      contentType: 'application/json',
    });
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
  }
}

module.exports = { MarketClient, EXCHANGE, KEYS };
