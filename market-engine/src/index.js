// 시세 엔진 시작점: RabbitMQ 연결 → exchange 선언
// control 구독은 B단계에서 추가합니다.
const amqp = require("amqplib");
const config = require("./config");
const logger = require("./logger");

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
      logger.warn({ attempt, error: err.message }, "RabbitMQ 연결 실패");
      if (attempt > retryCount) throw err;
      await sleep(retryDelayMs);
    }
  }
}

async function main() {
  const connection = await connectWithRetry();
  const channel = await connection.createChannel();

  // protocol.md 3장: exchange 이름 market, topic 타입
  // durable 값은 게임 서버와 반드시 같아야 합니다.
  await channel.assertExchange(config.rabbitmq.exchange, "topic", {
    durable: true,
  });
  logger.info({ exchange: config.rabbitmq.exchange }, "exchange 선언 완료");

  // RabbitMQ가 갑자기 끊기면 종료 → Docker가 다시 띄우도록 함
  connection.on("close", () => {
    logger.error("RabbitMQ 연결 끊김, 종료합니다");
    process.exit(1);
  });

  // Ctrl+C 또는 docker stop 시 깔끔하게 종료
  const shutdown = async () => {
    logger.info("시세 엔진 종료 중");
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
  logger.error({ error: err.message }, "시세 엔진 시작 실패");
  process.exit(1);
});
