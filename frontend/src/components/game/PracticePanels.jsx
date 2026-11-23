import { formatNumber, formatWon } from '../../utils/format'

// 연습 모드 전용: 내 체결 내역
export function TradeHistory({ trades }) {
  return (
    <section aria-label="내 체결 내역" className="gm-card gm-panel gm-half">
      <div className="gm-row">
        <h2 className="gm-h2">내 체결 내역</h2>
        <span className="gm-muted gm-small">평균 체결가 기준</span>
      </div>
      {trades.length === 0 ? (
        <p className="gm-empty">아직 체결된 주문이 없어요</p>
      ) : (
        <ul className="gm-trades">
          {trades.slice(0, 8).map((trade, index) => (
            <li key={`${trade.t}-${index}`}>
              <span className="gm-muted">D+{Math.max(1, Math.ceil(trade.t / 5))}</span>
              <strong className={trade.side === 'buy' ? 'up' : 'down'}>{trade.side === 'buy' ? '매수' : '매도'}</strong>
              <span>{formatNumber(trade.qty)}주</span>
              <span className="right">{formatWon(trade.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// 연습 모드 전용: 진행 상황 (캔들 1개 = 실제 하루 = 5초)
export function PracticeProgress({ day, totalDays }) {
  const pct = totalDays ? Math.min(100, Math.round((day / totalDays) * 100)) : 0
  return (
    <section aria-label="진행" className="gm-card gm-panel">
      <h2 className="gm-h2">진행</h2>
      <div className="gm-kv">
        <span className="gm-muted">거래일</span>
        <span>{day} / {totalDays}일</span>
      </div>
      <div className="gm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalDays} aria-valuenow={day}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <p className="gm-text">게임이 끝나면 실제 종목, 기간, 업종과 그 당시 지표를 공개합니다.</p>
    </section>
  )
}
