import { changeClass, formatChangePct } from '../../utils/format'

function RankingPanel({ ranks, playerId }) {
  const sorted = [...ranks].sort((a, b) => a.rank - b.rank)
  return (
    <section aria-label="실시간 순위" className="gm-card gm-panel">
      <div className="gm-row">
        <h2 className="gm-h2">실시간 순위</h2>
        <span className="gm-muted gm-small">수익률</span>
      </div>
      {sorted.length === 0 ? (
        <p className="gm-empty">순위를 기다리는 중</p>
      ) : (
        <ol className="gm-ranks">
          {sorted.map((rank) => {
            const me = rank.playerId === playerId
            return (
              <li key={rank.playerId} className={me ? 'me' : ''}>
                <span className={`no ${rank.rank === 1 ? 'first' : ''}`}>{rank.rank}</span>
                <span className="name">{rank.nickname}{me ? ' (나)' : ''}</span>
                <span className={changeClass(rank.returnPct)}>{formatChangePct(rank.returnPct)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default RankingPanel
