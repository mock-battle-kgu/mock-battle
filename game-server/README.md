# game-server

방 관리, 게임 진행, 주문 체결, 순위, 루머 카드를 담당하는 서버

## 로컬 실행
게임 서버는 RabbitMQ가 있어야 시작됩니다.

```bash
# 1. RabbitMQ 띄우기 (처음 한 번)
docker run -d --name mq -p 5672:5672 -p 15672:15672 rabbitmq:4-management

# 2. 게임 서버
npm install
npm start                    # http://localhost:4000/health

# 3. 시세 엔진 대신 가짜 시세 보내기 (다른 터미널)
npm run fake-market          # 방 000000으로 1초마다 시세 전송
```

RabbitMQ 관리 화면: http://localhost:15672 (guest / guest)

## 테스트
```bash
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
| LOG_LEVEL | info | `debug`로 바꾸면 받은 시세도 로그에 출력 |

## RabbitMQ 약속 (시세 엔진과 맞출 것)
- exchange 이름 `market`, 타입 `topic`, `durable: true`
- 경로: `market.control`, `market.flow`(게임 서버 → 시세 엔진), `market.tick`, `market.news`(시세 엔진 → 게임 서버)
