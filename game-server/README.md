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
npm run fake-market          # 게임이 시작되면 그 방에 자동으로 시세 전송
```

한 판을 처음부터 끝까지 확인 (화면 없이, 창 3개):
```bash
npm start              # 창 1: 게임 서버 (짧게 하려면 $env:GAME_DURATION_SEC="20"; npm start)
npm run fake-market    # 창 2: 시작 신호를 듣고 그 방에 시세 전송, 시간이 되면 멈춤
npm run try-room       # 창 3: 봇이 방 생성 → 입장 → 시작 → 종료까지
```
- 연습 모드: `$env:TRY_MODE="practice"; npm run try-room`
- 지정한 방에 바로 시세 보내기: `npm run fake-market -- 482913`
- 실제 시세 엔진이 시세를 보내는 중이면 fake-market은 켜지 마세요 (가격이 두 군데서 들어옴)

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
| SCENARIO_IDS | covid-2020,chip-2024,battery-2023,platform-2021 | 연습 모드 시나리오 목록 |
| LOG_DIR | ./logs | 로그 저장 폴더 (Docker에서는 볼륨) |
| LOG_LEVEL | info | `debug`로 바꾸면 받은 시세도 로그에 출력 |

## RabbitMQ 약속 (시세 엔진과 맞출 것)
- exchange 이름 `market`, 타입 `topic`, `durable: true`
- 경로: `market.control`, `market.flow`(게임 서버 → 시세 엔진), `market.tick`, `market.news`(시세 엔진 → 게임 서버)
