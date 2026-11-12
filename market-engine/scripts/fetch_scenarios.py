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
SCENARIOS = [
    {"id": "covid-2020", "code": "005930", "name": "삼성전자", "start": "2020-01-02"},
    {"id": "chip-2024", "code": "000660", "name": "SK하이닉스", "start": "2024-01-02"},
    {"id": "platform-2021", "code": "035720", "name": "카카오", "start": "2021-06-01"},
    {"id": "battery-2023", "code": "086520", "name": "에코프로", "start": "2023-01-02"},
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
        index.append({
            "id": s["id"],
            "file": file_name,
            "name": s["name"],
            "code": s["code"],
            "period": f"{first[:7]} ~ {last[:7]}",
            "days": len(rows),
        })
        print(f"  → {file_name} 저장 ({first} ~ {last}, {len(rows)}일)")

    with open(SCENARIO_DIR / "index.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump({"scenarios": index}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"index.json 저장 완료 (시나리오 {len(index)}개)")


if __name__ == "__main__":
    main()
