# 모의투자 배틀 (Mock Investment Battle)

친구들과 10분 동안 실시간으로 겨루는 모의투자 대결 게임

## 핵심 기능
1. **10분 실시간 방 대결**: PIN으로 입장해 같은 시장에서 동시에 겨루기
2. **블라인드 실전 리플레이**: 종목명·날짜를 가린 실제 과거 장세 재생, 종료 후 정체 공개
3. **루머 카드**: 진짜 뉴스와 구별되지 않는 루머를 퍼뜨리는 심리전

## 폴더 구조
```
frontend/        화면 (React)
game-server/     방 관리, 주문 체결, 실시간 순위 (Socket.IO)
api-server/      회원, 전적, 랭킹
market-engine/   시세 생성·리플레이
scenarios/       과거 주가 시나리오 데이터 (볼륨으로 연결)
docs/            설계 문서, 통신 규칙
```

## 브랜치 전략 (Git Flow)
```
main        배포용. develop / release/* / hotfix/* 에서만 병합
 └ develop  개발 통합
    ├ feature/기능명   새 기능   (예: feature/order-system)
    ├ fix/버그명       버그 수정 (예: fix/balance-error)
    └ docs/내용        문서 작업
release/버전  배포 준비 (develop → main)
hotfix/내용   main 긴급 수정
```
- `main`, `develop`에는 직접 push 금지, **PR + 리뷰 1명 이상** 필수
- 브랜치 규칙은 GitHub Actions(`branch-rule-check`)가 자동 검사

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
