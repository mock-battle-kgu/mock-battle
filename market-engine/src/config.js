// 환경 변수와 상수를 한곳에 모아둡니다.
// 가격 모델 상수는 C단계에서 여기에 추가합니다.
const path = require("path");

module.exports = {
  rabbitmq: {
    // 로컬: amqp://localhost / Docker Compose: amqp://rabbitmq
    url: process.env.RABBITMQ_URL || "amqp://localhost",
    exchange: "market", // protocol.md 3장
    retryCount: 5, // 연결 실패 시 재시도 횟수
    retryDelayMs: 3000, // 재시도 간격 (3초)
  },
  // 연습 모드 시나리오 폴더 (컨테이너에서는 /app/scenarios)
  scenarioDir:
    process.env.SCENARIO_DIR || path.resolve(__dirname, "../../scenarios"),
  // 틱 간격 (테스트에서는 줄여서 사용)
  tickMs: Number(process.env.TICK_MS) || 1000,
  logLevel: process.env.LOG_LEVEL || "info",
};
