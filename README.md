# 모의투자 배틀 (Mock Investment Battle)

최대 8명이 같은 시장에 모여 10분 동안 실시간으로 겨루는 모의투자 대결 게임.
기존 모의투자가 '차트 vs 나'라면, 모의투자 배틀은 참가자끼리 시장을 흔드는 '사람 vs 사람'입니다.

## 핵심 기능
1. **최대 8인 실시간 방 대결**: PIN으로 방에 입장하고, 모든 참가자가 같은 시세로 동시에 겨루며 수익률 순위가 실시간으로 바뀜
2. **루머 카드 심리전**: 진짜 뉴스와 구별되지 않는 루머를 다른 참가자 화면에 띄우고, 게임 종료 후 누가 퍼뜨렸는지 공개
3. **플레이어가 움직이는 시장**: 참가자들의 매수·매도량이 가격에 반영되어 담합·작전·배신이 가능

## 게임 모드
| 모드 | 인원 | 시세 | 설명 |
|---|---|---|---|
| 대결 모드 (메인) | 2~8명 | 시세 엔진이 만든 가상 시장 | 핵심 기능 3가지가 모두 동작하는 모드 |
| 연습 모드 | 1명 | 실제 과거 주가 (종목명·날짜 숨김) | 혼자 매매 감각을 익히는 블라인드 모드, 종료 후 정체 공개 |

자세한 규칙과 설계는 [docs/game-design.md](docs/game-design.md) 참고

## 폴더 구조
```
frontend/        화면 (React)
game-server/     방 관리, 주문 체결, 실시간 순위 (Socket.IO)
api-server/      게임 결과 저장, 랭킹
market-engine/   시세 생성(대결 모드)·과거 주가 재생(연습 모드)
scenarios/       연습 모드용 과거 주가 데이터 (볼륨으로 연결)
docs/            설계 문서, 통신 규칙
```

## 실행 방법

### 1. 사전 준비
- Git
- Docker Desktop
- Docker Compose

### 2. 프로젝트 클론
```bash
git clone https://github.com/mock-battle-kgu/mock-battle.git
cd mock-battle
```

### 3. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성합니다.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

필요한 경우 `.env`의 데이터베이스 및 RabbitMQ 비밀번호를 변경합니다.

### 4. Docker Compose 실행

```bash
docker compose up -d --build
```

컨테이너 상태 확인:
```bash
docker compose ps
```

### 5. 서비스 접속

| 서비스 | 주소 |
|---|---|
| Nginx | http://localhost |
| RabbitMQ Management | http://localhost:15672 |

RabbitMQ 초기 로그인 정보는 `.env`에 설정한 `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`를 사용합니다.

### 6. 종료

```bash
docker compose down
```

데이터 볼륨까지 삭제하려면:
```bash
docker compose down -v
```
- **주의:** 이 명령은 데이터베이스를 포함한 Docker 볼륨을 삭제하므로 저장된 데이터가 모두 사라집니다.
- **주의:** 현재 일부 애플리케이션 서비스는 초기 구성용 임시 컨테이너입니다. 실제 애플리케이션 실행은 각 서비스의 구현 및 Docker 설정 완료 후 가능합니다.

## 브랜치 전략 (Git Flow)
```
main          배포용 완성본
 └ develop    개발 통합
    └ feature/작업명   새 기능·문서 작업 (예: feature/order-system)
release/버전   배포 전 최종 점검 (예: release/v0.1)
hotfix/내용    main에서 발견한 긴급 버그 수정 (예: hotfix/login-error)
```

| 브랜치 | 만드는 곳 | 병합하는 곳 | 언제 |
|---|---|---|---|
| feature/* | develop | develop | 작업 하나를 시작할 때마다 |
| release/* | develop | main, develop | 기능 묶음이 develop에 모였을 때 |
| hotfix/* | main | main, develop | main에서 버그를 발견했을 때 |

- `main`, `develop`에는 직접 push 금지, **PR + 리뷰 1명 이상** 필수
- 위 5종류 외의 브랜치는 사용하지 않으며, Actions(`branch-rule-check`)가 병합 방향을 자동 검사
- 병합이 끝난 feature, release, hotfix 브랜치는 삭제

## 작업 순서
1. Issue 확인 후 본인 담당으로 지정
2. `develop`에서 브랜치 생성
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/기능명
   ```
3. 작업 후 push, `develop` 대상으로 PR 작성
4. Actions 검사 통과 + 리뷰 승인 후 병합
5. 병합된 브랜치는 삭제

## PR 제목·커밋 규칙
`종류: 설명` 형식 (PR 제목은 Actions가 자동 검사)

| 종류 | 의미 |
|---|---|
| feat | 새 기능 |
| fix | 버그 수정 |
| docs | 문서 |
| refactor | 리팩터링 |
| test | 테스트 |
| chore | 설정, 기타 |
| ci | GitHub Actions |

예: `feat: 매수 주문 체결 기능 추가`, `fix(game-server): 잔고 음수 버그 수정`

## 팀원
| 이름 | GitHub | 담당 |
|---|---|---|
|  |  | 프론트엔드 |
|  |  | 게임 서버 |
|  |  | 시세 엔진 |
|  |  | API·DB |
|  |  | 인프라·CI |
