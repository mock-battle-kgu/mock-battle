import { formatRatio, formatWon } from '../../utils/format'
import { valuation } from '../../utils/indicators'

const BADGE = {
  low: { text: '저평가', className: 'low' },
  high: { text: '고평가', className: 'high' },
  fair: { text: '적정', className: 'fair' },
}

// 종목 지표: PER·PBR은 현재가로 매 틱 다시 계산한다
// 대결: 업종·소개까지 표시 / 연습: 업종·소개는 게임이 끝나면 공개
function StockInfoCard({ isBattle, name, info, profile, price }) {
  const eps = info?.eps
  const per = eps > 0 && price ? price / eps : null
  const pbr = info?.bps > 0 && price ? price / info.bps : null
  const badge = BADGE[valuation(per, info?.sectorPer)]

  return (
    <section aria-label="종목 정보" className="gm-card gm-panel gm-half">
      <div className="gm-row">
        <h2 className="gm-h2">종목 정보</h2>
        {badge && <span className={`gm-val-badge ${badge.className}`}>{badge.text}</span>}
      </div>

      {isBattle ? (
        <div className="gm-info-head">
          <strong>
            {name}
            {info?.sector ? ` · ${info.sector}` : ''}
          </strong>
          <span className="gm-muted">{profile?.description ?? ''}</span>
        </div>
      ) : (
        <div className="gm-info-head">
          <strong>업종 · 소개: 게임이 끝나면 공개</strong>
          <span className="gm-muted">그 당시 실제 지표입니다. 금액은 가격과 같은 비율로 바뀌어 PER·PBR은 실제와 같습니다.</span>
        </div>
      )}

      {info ? (
        <div className="gm-metrics">
          <div className="gm-metric"><span className="gm-muted">EPS</span><strong>{formatWon(eps)}</strong></div>
          <div className="gm-metric"><span className="gm-muted">PER</span><strong>{formatRatio(per)}</strong><span className="gm-tiny">현재가 ÷ EPS</span></div>
          <div className="gm-metric"><span className="gm-muted">PBR</span><strong>{formatRatio(pbr, 2)}</strong><span className="gm-tiny">현재가 ÷ BPS</span></div>
          <div className="gm-metric"><span className="gm-muted">업종 평균 PER</span><strong>{formatRatio(info.sectorPer, 0)}</strong></div>
        </div>
      ) : (
        <p className="gm-empty">종목 지표를 기다리는 중</p>
      )}

      <p className="gm-note">
        PER이 업종 평균의 0.9배 미만이면 저평가, 1.1배를 넘으면 고평가로 표시합니다.
        {isBattle ? ' 지표는 판마다 달라집니다.' : ' 연습 모드 가격은 실제 주가 그대로라 지표는 판단의 참고 자료입니다.'}
      </p>
    </section>
  )
}

export default StockInfoCard
