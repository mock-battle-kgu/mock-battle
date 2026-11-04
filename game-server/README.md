# game-server

방 관리, 게임 진행, 주문 체결, 순위, 루머 카드를 담당하는 서버

## 실행
```bash
npm install
npm start          # http://localhost:4000/health
npm test
npm run lint
```

## 환경 변수
| 이름 | 기본값 | 설명 |
|---|---|---|
| PORT | 4000 | 서버 포트 |
| RABBITMQ_URL | amqp://localhost | RabbitMQ 주소 |
| API_URL | http://localhost:3000 | API 서버 주소 |
| GAME_DURATION_SEC | 600 | 한 판 시간(초) |
| LOG_DIR | ./logs | 로그 저장 폴더 (Docker에서는 볼륨) |
