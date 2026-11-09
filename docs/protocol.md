# 통신 메시지 규약 (v0.2)

모든 컨테이너가 주고받는 메시지의 이름과 형식을 정의합니다.
이 문서를 바꿀 때는 반드시 PR로 수정하고, 영향을 받는 담당자가 리뷰합니다.

## 0. 전체 흐름

```
[화면] ⇄ (Socket.IO) ⇄ [게임 서버] ⇄ (RabbitMQ) ⇄ [시세 엔진]
                            │
                            └→ (REST) → [API 서버] → [DB]
```

| 구간 | 방식 | 이유 |
|---|---|---|
| 화면 ↔ 게임 서버 | Socket.IO 이벤트 | 실시간 양방향 통신 |
| 게임 서버 ↔ 시세 엔진 | RabbitMQ 메시지 | 서버끼리 비동기 전달 |
| 게임 서버 → API 서버 | REST (HTTP) | 게임 결과 저장, 조회 |

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 형식 | JSON, 키 이름은 camelCase |
| 금액 | 정수, 단위 원 (예: `60400`) |
| 수익률 | 퍼센트, 소수점 1자리 (예: `24.5`, `-8.6`) |
| 시간 `t` | 게임 시작 후 경과 초 (0 ~ 600) |
| `roomId` | 6자리 PIN 문자열 (예: `"482913"`) |
| `playerId` | 서버가 발급 (`"p1"` ~ `"p8"`) |
| `mode` | `"battle"` (대결 모드) / `"practice"` (연습 모드) |
| `side` | `"buy"` (매수) / `"sell"` (매도) |

### 종목 코드 (대결 모드)

| 코드 | 종목명 |
|---|---|
| `GANA` | 가나전자 |
| `DARA` | 다라항공 |
| `MABA` | 마바게임즈 |
| `SAAH` | 사아바이오 |
| `JACHA` | 자차푸드 |
| `KATA` | 카타에너지 |

연습 모드는 실제 종목을 숨기기 위해 `STOCK_A` 하나만 사용합니다.

## 2. 화면 ↔ 게임 서버 (Socket.IO)

### 2-1. 요청 (화면 → 게임 서버)
요청은 Socket.IO **acknowledgement(응답 콜백)** 으로 결과를 받습니다.
성공: `{ "ok": true, ... }` / 실패: `{ "ok": false, "code": "오류코드", "message": "설명" }`

#### `room:create` 방 만들기
```json
// 요청
{ "nickname": "단타의신", "mode": "battle" }
// 응답
{ "ok": true, "roomId": "482913", "playerId": "p1" }
```
연습 모드는 `"mode": "practice"`로 방을 만들고, 다른 사람은 입장할 수 없습니다(`ROOM_FULL`).
실패 코드: `INVALID_NICKNAME`(1~10자 아님), `INVALID_MODE`(battle·practice 아님)

#### `room:join` 방 입장
```json
// 요청
{ "roomId": "482913", "nickname": "존버왕" }
// 응답
{ "ok": true, "playerId": "p2" }
```
실패 코드: `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_STARTED`, `NICKNAME_TAKEN`, `INVALID_NICKNAME`

#### `room:start` 게임 시작 (방장만)
```json
// 요청
{ "roomId": "482913" }
// 응답
{ "ok": true }
```
실패 코드: `NOT_HOST`, `NOT_ENOUGH_PLAYERS` (대결 모드는 2명 이상)

#### `order:place` 매수·매도 주문
```json
// 요청
{ "roomId": "482913", "stock": "GANA", "side": "buy", "qty": 50 }
// 응답
{ "ok": true, "price": 60400, "qty": 50, "cash": 6980000 }
```
실패 코드: `NOT_ENOUGH_CASH`, `NOT_ENOUGH_SHARES`, `INVALID_QTY`, `GAME_NOT_PLAYING`

#### `rumor:use` 루머 카드 사용 (대결 모드만)
```json
// 요청
{ "roomId": "482913", "stock": "GANA", "direction": "up" }
// 응답
{ "ok": true, "rumorCardsLeft": 1 }
```
- `direction`: `"up"` (호재 루머) / `"down"` (악재 루머)
- 루머 문장은 서버가 미리 준비한 문장 중에서 골라 만듭니다. 참가자가 직접 문장을 쓰지 않습니다. (부적절한 글 방지)
- 실패 코드: `NO_RUMOR_CARD`, `GAME_NOT_PLAYING`

### 2-2. 알림 (게임 서버 → 화면)

#### `room:update` 대기실 상태 변경 (방 전체)
```json
{
  "roomId": "482913",
  "mode": "battle",
  "hostId": "p1",
  "status": "waiting",
  "players": [
    { "playerId": "p1", "nickname": "단타의신", "connected": true },
    { "playerId": "p2", "nickname": "존버왕", "connected": true }
  ]
}
```
- `status`: `"waiting"` / `"playing"` / `"ended"`
- 대기 중 방장이 나가면 다음 참가자가 방장(`hostId` 변경), 게임 중 나간 참가자는 `connected: false`로 순위에 남음

#### `game:start` 게임 시작 (방 전체)
```json
{
  "mode": "battle",
  "durationSec": 600,
  "startCash": 10000000,
  "rumorCards": 2,
  "stocks": [
    { "code": "GANA", "name": "가나전자", "price": 46000 },
    { "code": "DARA", "name": "다라항공", "price": 19000 }
  ]
}
```

#### `price:tick` 현재가 (방 전체, 1초마다)
```json
{ "t": 125, "prices": { "GANA": 60400, "DARA": 18450 } }
```

#### `candle:close` 캔들 완성 (방 전체, 5초마다)
```json
{ "t": 125, "candles": { "GANA": { "o": 59800, "h": 60600, "l": 59700, "c": 60400 } } }
```
캔들은 서버가 만들어 보내서 모든 참가자의 차트가 똑같이 보이게 합니다.

#### `portfolio:update` 내 잔고 (해당 참가자에게만, 체결 시와 1초마다)
```json
{
  "cash": 6980000,
  "holdings": { "GANA": { "qty": 120, "avgPrice": 48900 } },
  "totalAsset": 12450000,
  "returnPct": 24.5
}
```

#### `rank:update` 실시간 순위 (방 전체, 1초마다)
```json
{
  "t": 125,
  "ranks": [
    { "rank": 1, "playerId": "p3", "nickname": "단타의신", "returnPct": 31.8 },
    { "rank": 2, "playerId": "p1", "nickname": "존버왕", "returnPct": 24.5 }
  ]
}
```

#### `news:push` 뉴스 (방 전체)
```json
{ "newsId": "n17", "t": 210, "stock": "GANA", "headline": "가나전자, 차세대 칩 대형 수주 임박" }
```
**진짜 뉴스와 루머를 같은 형식으로 보냅니다.** 루머인지 알려주는 값은 게임이 끝날 때까지 절대 넣지 않습니다.

#### `market:flow` 플레이어 시장 영향 (방 전체, 1초마다)
```json
{ "t": 125, "windowSec": 10, "buyRatio": { "GANA": 0.64 }, "impactPct": { "GANA": 1.8 } }
```
화면의 "매수 64% / 매도 36%" 막대와 "가격 +1.8% 반영" 표시에 사용합니다.

#### `game:end` 게임 종료 (방 전체)
```json
{
  "ranks": [
    { "rank": 1, "playerId": "p3", "nickname": "단타의신", "returnPct": 31.8, "totalAsset": 13180000 }
  ],
  "rumors": [
    { "newsId": "n17", "playerId": "p3", "nickname": "단타의신" }
  ],
  "reveal": null
}
```
- `rumors`: 어떤 뉴스가 루머였고 누가 퍼뜨렸는지 공개
- `reveal`: 연습 모드에서만 사용 → `{ "name": "실제 종목명", "period": "2020-01 ~ 2020-12" }`

## 3. 게임 서버 ↔ 시세 엔진 (RabbitMQ)

exchange 이름: `market` (topic 타입, **durable: true**). 게임 서버와 시세 엔진이 반드시 같은 옵션으로 선언해야 합니다. 모든 메시지에 `roomId`를 넣어 방별로 구분합니다.

| routing key | 방향 | 시점 |
|---|---|---|
| `market.control` | 게임 서버 → 시세 엔진 | 게임 시작·종료 |
| `market.flow` | 게임 서버 → 시세 엔진 | 1초마다 |
| `market.tick` | 시세 엔진 → 게임 서버 | 1초마다 |
| `market.news` | 시세 엔진 → 게임 서버 | 뉴스 발생 시 |

#### `market.control` 시장 시작·종료
```json
{ "type": "start", "roomId": "482913", "mode": "battle", "durationSec": 600, "stocks": ["GANA", "DARA", "MABA", "SAAH", "JACHA", "KATA"] }
```
```json
{ "type": "start", "roomId": "771205", "mode": "practice", "durationSec": 600, "scenarioId": "covid-2020" }
```
```json
{ "type": "stop", "roomId": "482913" }
```

#### `market.flow` 참가자 순매수량 (플레이어 시장 영향의 입력값)
```json
{ "roomId": "482913", "t": 125, "netQty": { "GANA": 340, "DARA": -120 } }
```
`netQty` = 지난 1초 동안의 매수 수량 − 매도 수량. 시세 엔진이 최근 10초치를 모아 다음 가격에 반영합니다. (연습 모드에서는 보내지 않음)

#### `market.tick` 가격
```json
{ "roomId": "482913", "t": 125, "prices": { "GANA": 60400, "DARA": 18450 }, "impactPct": { "GANA": 1.8, "DARA": -0.6 } }
```
게임 서버는 이 값을 받아 `price:tick`, `market:flow`로 화면에 전달합니다.

#### `market.news` 진짜 뉴스
```json
{ "roomId": "482913", "t": 210, "stock": "DARA", "headline": "다라항공, 유가 급등에 실적 경고", "effectPct": -4.0 }
```
`effectPct`(뉴스가 가격에 주는 영향)는 시세 엔진 내부용입니다. 게임 서버는 화면에 `headline`만 전달합니다.

## 4. 게임 서버 → API 서버 (REST)

기본 주소: `http://api-server:3000` (Docker Compose 내부 이름)

#### `POST /api/results` 게임 결과 저장
```json
// 요청
{
  "roomId": "482913",
  "mode": "battle",
  "playedAt": "2026-11-20T14:05:00+09:00",
  "durationSec": 600,
  "players": [
    { "nickname": "단타의신", "rank": 1, "returnPct": 31.8, "totalAsset": 13180000, "rumorsUsed": 2 }
  ]
}
// 응답 201
{ "gameId": 42 }
```

#### `GET /api/hall-of-fame?limit=10` 명예의 전당
```json
// 응답 200
[ { "nickname": "단타의신", "returnPct": 31.8, "playedAt": "2026-11-20T14:05:00+09:00" } ]
```
랭킹 방식(명예의 전당 / 회원 누적 랭킹)이 확정되면 이 부분을 수정합니다.

#### `GET /api/health` 상태 확인
```json
// 응답 200
{ "status": "ok" }
```
Docker 헬스체크와 GitHub Actions 통합 테스트에서 사용합니다.

## 5. 오류 코드 모음

| 코드 | 의미 |
|---|---|
| `ROOM_NOT_FOUND` | 없는 PIN |
| `ROOM_FULL` | 8명이 이미 입장 |
| `GAME_STARTED` | 이미 시작된 방 |
| `NICKNAME_TAKEN` | 같은 방에 같은 닉네임 존재 |
| `NOT_HOST` | 방장이 아님 |
| `NOT_ENOUGH_PLAYERS` | 대결 모드 인원 부족 (2명 미만) |
| `GAME_NOT_PLAYING` | 게임 중이 아님 |
| `NOT_ENOUGH_CASH` | 현금 부족 |
| `NOT_ENOUGH_SHARES` | 보유 수량 부족 |
| `INVALID_QTY` | 수량이 1 미만이거나 정수가 아님 |
| `NO_RUMOR_CARD` | 루머 카드 소진 |
| `INVALID_NICKNAME` | 닉네임이 비었거나 10자 초과 |
| `INVALID_MODE` | mode가 battle·practice가 아님 |
| `INTERNAL_ERROR` | 서버 내부 오류 |
