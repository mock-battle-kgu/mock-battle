// 환경 변수와 상수를 한곳에 모아둡니다.
// 수치는 초안이며 H단계(튜닝)에서 조정합니다.
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

  // 가격 규칙 (가이드 4-1)
  price: {
    maxTickChange: 0.05, // 한 틱에 ±5% 넘게 움직이지 않음
    minPrice: 1000, // 최저 1,000원
    unit: 10, // 10원 단위
  },
};
