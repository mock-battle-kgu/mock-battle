import { formatTime } from '../../utils/format'

// 뉴스 피드: 진짜 뉴스와 루머가 같은 모양으로 보인다 (루머 카드 사용은 v1.0)
function NewsPanel({ news, elapsedTime, rumorCards }) {
  const latest = [...news].reverse().slice(0, 5)
  return (
    <section aria-label="뉴스 피드" className="gm-card gm-panel">
      <div className="gm-row">
        <h2 className="gm-h2">뉴스 피드</h2>
        <span className="gm-hint-badge">진짜일까?</span>
      </div>
      {latest.length === 0 ? (
        <p className="gm-empty">아직 속보가 없어요</p>
      ) : (
        latest.map((item, index) => (
          <article key={item.newsId} className={`gm-news ${index === 0 ? 'hot' : ''}`}>
            <div className="gm-news-meta">
              <span className="gm-news-tag">속보</span>
              <span className="gm-muted gm-small">
                {elapsedTime - item.t < 10 ? '방금' : `${formatTime(elapsedTime - item.t)} 전`}
              </span>
            </div>
            <span>{item.headline}</span>
          </article>
        ))
      )}
      <button type="button" className="gm-rumor" disabled title="루머 카드는 v1.0에서 열립니다">
        루머 카드 · {rumorCards}장 (준비 중)
      </button>
    </section>
  )
}

export default NewsPanel
