// 모든 설정은 환경 변수로 받는다 (코드에 주소를 직접 쓰지 않기)
module.exports = {
  port: Number(process.env.PORT) || 4000,
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  gameDurationSec: Number(process.env.GAME_DURATION_SEC) || 600,
  logDir: process.env.LOG_DIR || './logs',
};
