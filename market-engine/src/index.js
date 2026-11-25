// 시세 엔진 시작점: RabbitMQ 연결 → exchange 선언 → market.control·market.flow 구독 → market.tick·market.news 발행
const amqp = require("amqplib");
const config = require("./config");
const logger = require("./logger");
const RoomManager = require("./RoomManager");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 처음 1번 + 재시도 5번, 3초 간격
async function connectWithRetry() {
  const { url, retryCount, retryDelayMs } = config.rabbitmq;

  for (let attempt = 1; attempt <= retryCount + 1; attempt++) {
    try {
      const connection = await amqp.connect(url);
      logger.info({ attempt }, "RabbitMQ 연결 성공");
      return connection;
    } catch (err) {
      // localhost 연결 실패는 message가 비어 있을 수 있어 code를 함께 기록
      logger.warn({ attempt, error: err.code || err.message }, "RabbitMQ 연결 실패");
      if (attempt > retryCount) throw err;
      await sleep(retryDelayMs);
    }
  }
}

async function main() {
  const connection = await connectWithRetry();
  const channel = await connection.createChannel();
  const { exchange } = config.rabbitmq;

  // protocol.md 3장: exchange 이름 market, topic 타입 (게임 서버와 durable 일치)
  await channel.assertExchange(exchange, "topic", { durable: true });
  logger.info({ exchange }, "exchange 선언 완료");

  // 게임 서버로 메시지 발행 (protocol.md 3장)
  const publish = (routingKey, body) =>
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), {
      contentType: "application/json",
    });

  const rooms = new RoomManager({
    tickMs: config.tickMs,
    logger,
    onTick: (room) => {
      const codes = Object.keys(room.prices);
      if (codes.length === 0) return;
      // impactPct: 최근 10초 플레이어 순매수 영향 (연습 모드는 항상 0)
      publish("market.tick", {
        roomId: room.roomId,
        t: room.t,
        prices: room.prices,
        impactPct: room.impactPct,
      });
      logger.debug({ roomId: room.roomId, t: room.t, prices: room.prices }, "tick 발행");
    },
    // protocol.md 3장 market.news (effectPct는 시세 엔진 내부용, 화면에는 headline만)
    onNews: (room, news) => {
      publish("market.news", { roomId: room.roomId, ...news });
      logger.info({ roomId: room.roomId, t: news.t, stock: news.stock }, "뉴스 발행");
    },
  });

  // market.control·market.flow 구독: 엔진 전용 임시 큐 (엔진이 꺼지면 자동 삭제)
  const { queue } = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(queue, exchange, "market.control");
  await channel.bindQueue(queue, exchange, "market.flow");
  await channel.consume(
    queue,
    (msg) => {
      if (!msg) return;
      const key = msg.fields.routingKey;
      try {
        const body = JSON.parse(msg.content.toString());
        if (key === "market.control") rooms.handleControl(body);
        else if (key === "market.flow") rooms.handleFlow(body);
      } catch (err) {
        logger.warn({ key, error: err.message }, "메시지를 읽을 수 없음");
      }
    },
    { noAck: true }
  );
  logger.info("market.control, market.flow 구독 시작");

  // RabbitMQ가 갑자기 끊기면 종료 → Docker가 다시 띄우도록 함
  connection.on("close", () => {
    logger.error("RabbitMQ 연결 끊김, 종료합니다");
    process.exit(1);
  });

  // Ctrl+C 또는 docker stop 시 깔끔하게 종료
  const shutdown = async () => {
    logger.info("시세 엔진 종료 중");
    rooms.stopAll();
    connection.removeAllListeners("close");
    await channel.close();
    await connection.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("시세 엔진 준비 완료");
}

main().catch((err) => {
  logger.error({ error: err.code || err.message }, "시세 엔진 시작 실패");
  process.exit(1);
});
