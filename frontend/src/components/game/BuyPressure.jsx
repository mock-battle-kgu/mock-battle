// 매수 압력 게이지 (대결 모드만): 최근 10초 참가자 매수 비율과 가격 반영
function BuyPressure({ name, flow, stock, playerCount }) {
  const ratio = flow?.buyRatio?.[stock]
  const impact = flow?.impactPct?.[stock]
  const buy = Number.isFinite(ratio) ? Math.round(ratio * 100) : null

  return (
    <section aria-label="매수 압력" className="gm-card gm-panel gm-half">
      <div className="gm-row">
        <h2 className="gm-h2">매수 압력 · {name}</h2>
        <span className="gm-muted gm-small">최근 {flow?.windowSec ?? 10}초 · 참가자 {playerCount}명 주문 합산</span>
      </div>
      {buy === null ? (
        <div className="gm-pressure empty">최근 10초 동안 거래 없음</div>
      ) : (
        <div className="gm-pressure" role="img" aria-label={`매수 ${buy}% 매도 ${100 - buy}%`}>
          <div className="buy" style={{ width: `${buy}%` }}>{buy >= 15 && `매수 ${buy}%`}</div>
          <div className="sell" style={{ width: `${100 - buy}%` }}>{100 - buy >= 15 && `매도 ${100 - buy}%`}</div>
        </div>
      )}
      {Number.isFinite(impact) && impact !== 0 && (
        <p className="gm-text">
          참가자 {impact > 0 ? '순매수' : '순매도'}가 몰려 가격에{' '}
          <strong className={impact > 0 ? 'up' : 'down'}>{impact > 0 ? `+${impact}` : impact}%</strong>가 추가로 반영됐습니다.
        </p>
      )}
      <p className="gm-note">대결 모드에서만 보입니다.</p>
    </section>
  )
}

export default BuyPressure
