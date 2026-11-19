
import { useNavigate } from 'react-router-dom'
import './Result.css'

const formatReturnPct = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—'

  const number = Number(value)
  const sign = number > 0 ? '+' : ''

  return `${sign}${number.toFixed(1)}%`
}

const formatAsset = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—'

  return `${Number(value).toLocaleString('ko-KR')}원`
}

function Result({ result, playerId, mode }) {
  const navigate = useNavigate()

  const myRank = result?.ranks?.find(
    (rank) => rank.playerId === playerId,
  )

  const isPractice =
    mode === 'practice' || Boolean(result?.reveal)

  const reveal = result?.reveal

  const returnPct = Number(myRank?.returnPct)
  const hasReturn = Number.isFinite(returnPct)
  const isPositive = hasReturn && returnPct >= 0

  return (
    <main className="result-page">
      <header className="result-header">
        <div>
          <p className="result-label">MOCK INVESTMENT BATTLE</p>
          <h1>게임 결과</h1>
          <p className="result-subtitle">
            {isPractice
              ? '연습 게임이 종료되었습니다.'
              : '투자 배틀이 종료되었습니다.'}
          </p>
        </div>

        <span className="result-mode">
          {isPractice ? '연습 모드' : '대전 모드'}
        </span>
      </header>

      {!result && (
        <section className="result-empty">
          <div className="result-empty-icon">!</div>
          <h2>아직 게임 결과가 없습니다.</h2>
          <p>
            게임이 종료되면 최종 결과를 확인할 수 있습니다.
          </p>
          <button
            type="button"
            className="result-home-button"
            onClick={() => navigate('/')}
          >
            홈으로 돌아가기
          </button>
        </section>
      )}

      {result && (
        <>
          <section className="result-summary">
            <div className="result-summary-heading">
              <span className="result-summary-label">
                FINAL RESULT
              </span>
              <h2>최종 투자 성적</h2>
            </div>

            {myRank ? (
              <>
                <div className="result-rank">
                  <span>최종 순위</span>
                  <strong>{myRank.rank ?? '—'}위</strong>
                </div>

                <div className="result-stats">
                  <article className="result-stat-card">
                    <span className="result-stat-label">
                      최종 수익률
                    </span>
                    <strong
                      className={`result-return ${
                        isPositive ? 'positive' : 'negative'
                      }`}
                    >
                      {formatReturnPct(myRank.returnPct)}
                    </strong>
                  </article>

                  <article className="result-stat-card">
                    <span className="result-stat-label">
                      최종 총자산
                    </span>
                    <strong className="result-asset">
                      {formatAsset(myRank.totalAsset)}
                    </strong>
                  </article>
                </div>
              </>
            ) : (
              <p className="result-missing">
                내 게임 결과를 찾을 수 없습니다.
              </p>
            )}
          </section>

          {isPractice && (
            <section className="result-reveal">
              <div className="result-section-heading">
                <div>
                  <span className="result-section-label">
                    PRACTICE REVEAL
                  </span>
                  <h2>실제 종목 공개</h2>
                </div>
                <span className="result-reveal-badge">
                  연습 모드
                </span>
              </div>

              {reveal ? (
                <div className="result-stock-info">
                  <div className="result-stock-main">
                    <span className="result-stock-caption">
                      실제 투자 종목
                    </span>
                    <h3>{reveal.name || '종목명 없음'}</h3>
                    {reveal.code && (
                      <span className="result-stock-code">
                        종목 코드 {reveal.code}
                      </span>
                    )}
                  </div>

                  <div className="result-period">
                    <span>분석 기간</span>
                    <strong>{reveal.period || '정보 없음'}</strong>
                  </div>
                </div>
              ) : (
                <p className="result-missing">
                  실제 종목 정보가 아직 전달되지 않았습니다.
                </p>
              )}
            </section>
          )}

          <section className="result-footer">
            <p>게임이 종료되었습니다.</p>
            <button
              type="button"
              className="result-home-button"
              onClick={() => navigate('/')}
            >
              홈으로 돌아가기
            </button>
          </section>
        </>
      )}
    </main>
  )
}

export default Result
