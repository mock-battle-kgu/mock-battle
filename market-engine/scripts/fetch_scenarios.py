"""연습 모드 시나리오 데이터 수집 스크립트

실제 과거 일별 주가를 받아 scenarios/ 폴더에 CSV와 index.json을 만듭니다.
데이터를 준비할 때 한 번만 실행하며, 컨테이너에는 들어가지 않습니다.

실행: python market-engine/scripts/fetch_scenarios.py
"""
import csv
import json
from pathlib import Path

import FinanceDataReader as fdr

# 하루 = 틱 5개(5초) → 600초 ÷ 5초 = 120 거래일
DAYS = 120
# 실제 가격을 숨기기 위해 첫날 종가를 이 값으로 맞춤
BASE_PRICE = 10000

# 시나리오 목록: id는 게임 서버가 scenarioId로 보내는 값
# fundamentals: 시나리오 시작 직전 사업연도의 실제 지표 (연습 모드 PER·PBR 표시용, 가이드 4-5)
#   - eps, bps는 FinanceDataReader 가격과 같은 기준(액면분할 반영 후)이어야 PER이 맞음
#   - 실행 후 출력되는 "실제 PER"이 알려진 값과 크게 다르면 기준이 어긋난 것
#   - sectorPer(업종 평균 PER)는 비교용 근사값, 적정가 회귀에는 쓰지 않음
SCENARIOS = [
    {
        "id": "covid-2020", "code": "005930", "name": "삼성전자", "start": "2020-01-02",
        # 2019년 연결: 지배주주 순이익 기준 기본 EPS, 지배주주 자본 ÷ 발행주식수(보통+우선)
        "fundamentals": {"sector": "반도체", "eps": 3166, "bps": 37528, "sectorPer": 15},
    },
    {
        "id": "chip-2024", "code": "000660", "name": "SK하이닉스", "start": "2024-01-02",
        # 2023년 연결: 적자(EPS 음수) → 화면에서는 PER 대신 "적자"로 표시해야 함
        "fundamentals": {"sector": "반도체", "eps": -13244, "bps": 73495, "sectorPer": 15},
    },
    {
        "id": "platform-2021", "code": "035720", "name": "카카오", "start": "2021-06-01",
        # 2020년 연결: 기본 EPS 1,838원 ÷ 5 (2021년 4월 5:1 액면분할 반영)
        # bps: 지배주주 자본 6조 2,989억 ÷ 분할 후 주식수(약 4.43억 주) = 근사값
        "fundamentals": {"sector": "인터넷 플랫폼", "eps": 368, "bps": 14220, "sectorPer": 40},
    },
    {
        "id": "battery-2023", "code": "086520", "name": "에코프로", "start": "2023-01-02",
        # 2022년 연결 (시작 직전 사업연도), 2024년 5:1 액면분할 반영 기준 (네이버 증권 투자지표)
        "fundamentals": {"sector": "2차전지 소재", "eps": 278, "bps": 9959, "sectorPer": 50},
    },
]

# 저장소 최상위의 scenarios/ 폴더 (어디서 실행해도 같은 위치)
SCENARIO_DIR = Path(__file__).resolve().parents[2] / "scenarios"


def round10(value):
    """10원 단위 반올림"""
    return int(round(value / 10.0)) * 10


def build_rows(df):
    """일봉 데이터를 비율은 유지한 채 첫 종가 10,000원 기준으로 바꿈"""
    df = df[["Open", "High", "Low", "Close"]]
    # 거래가 없는 날(시가 0 등)은 제외
    df = df[(df > 0).all(axis=1)].head(DAYS)
    if len(df) < DAYS:
        raise ValueError(f"거래일이 {len(df)}일뿐입니다. {DAYS}일이 필요합니다.")

    scale = BASE_PRICE / df["Close"].iloc[0]
    rows = []
    for date, r in df.iterrows():
        o, h, l, c = (round10(r[k] * scale) for k in ("Open", "High", "Low", "Close"))
        # 반올림 후에도 고가는 가장 높고, 저가는 가장 낮게 유지
        h = max(h, o, c)
        l = min(l, o, c)
        rows.append([date.strftime("%Y-%m-%d"), o, h, l, c])
    return rows


def first_close_of(df):
    """build_rows와 같은 기준(거래 없는 날 제외)의 실제 첫날 종가"""
    df = df[["Open", "High", "Low", "Close"]]
    df = df[(df > 0).all(axis=1)]
    return int(df["Close"].iloc[0])


def print_check(s, first_close):
    """실제 PER·PBR을 출력해서 지표 기준(액면분할 등)이 맞는지 눈으로 확인"""
    f = s.get("fundamentals") or {}
    eps, bps = f.get("eps"), f.get("bps")
    per = f"{first_close / eps:.1f}" if eps and eps > 0 else ("적자" if eps else "미입력")
    pbr = f"{first_close / bps:.2f}" if bps else "미입력"
    print(f"    실제 첫 종가 {first_close:,}원 → PER {per}, PBR {pbr}")


def main():
    SCENARIO_DIR.mkdir(exist_ok=True)
    index = []

    for s in SCENARIOS:
        print(f"[{s['id']}] {s['name']}({s['code']}) 받는 중...")
        df = fdr.DataReader(s["code"], s["start"])
        rows = build_rows(df)

        file_name = f"{s['id']}.csv"
        with open(SCENARIO_DIR / file_name, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, lineterminator="\n")
            writer.writerow(["date", "open", "high", "low", "close"])
            writer.writerows(rows)

        first, last = rows[0][0], rows[-1][0]
        first_close = first_close_of(df)
        index.append({
            "id": s["id"],
            "file": file_name,
            "name": s["name"],
            "code": s["code"],
            "period": f"{first[:7]} ~ {last[:7]}",
            "days": len(rows),
            "firstClose": first_close,  # 실제 첫날 종가 (지표를 가격과 같은 비율로 줄일 때 사용)
            "fundamentals": s.get("fundamentals"),
        })
        print(f"  → {file_name} 저장 ({first} ~ {last}, {len(rows)}일)")
        print_check(s, first_close)

    with open(SCENARIO_DIR / "index.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump({"scenarios": index}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"index.json 저장 완료 (시나리오 {len(index)}개)")


if __name__ == "__main__":
    main()
