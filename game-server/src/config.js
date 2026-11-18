// 모든 설정은 환경 변수로 받는다 (코드에 주소를 직접 쓰지 않기)
const list = (value, fallback) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : fallback);

module.exports = {
  port: Number(process.env.PORT) || 4000,
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  gameDurationSec: Number(process.env.GAME_DURATION_SEC) || 600,
  logDir: process.env.LOG_DIR || './logs',

  // 게임 규칙 (docs/game-design.md 4장 초안)
  startCash: 10_000_000,
  rumorCards: 2,
  // 시세가 끊겨도 게임이 끝나도록 하는 여유 시간(초)
  backupGraceSec: 5,
  // 게임이 끝난 뒤 방을 지우기까지 기다리는 시간(밀리초)
  endedRoomTtlMs: 30_000,
  // 연습 모드 시나리오 (scenarios/index.json의 id)
  scenarioIds: list(process.env.SCENARIO_IDS, ['covid-2020', 'chip-2024', 'battery-2023', 'platform-2021']),
};
