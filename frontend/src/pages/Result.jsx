
import { useNavigate } from 'react-router-dom'

function Result({ result, playerId, mode }) {
  const navigate = useNavigate()

  // 내 playerId와 일치하는 결과만 사용
  const myRank = result?.ranks?.find(
    (rank) => rank.playerId === playerId
  )

  const isPractice = mode === 'practice' || Boolean(result?.reveal)
  const reveal = result?.reveal

  const formatReturnPct = (value) => {
    if (typeof value !== 'number') return '-'

    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  const formatAsset = (value) => {
    if (typeof value !== 'number') return '-'

    return `${value.toLocaleString('ko-KR')}원`
  }

  return (
    <main>
      <h1>게임 결과</h1>

      {!result && (
        <p>아직 게임 결과가 없습니다.</p>
      )}

      {result && !myRank && (
        <p>내 게임 결과를 찾을 수 없습니다.</p>
      )}

      {myRank && (
        <section>
          <h2>최종 결과</h2>

          <p>
            최종 순위: {myRank.rank}위
          </p>

          <p>
            최종 수익률: {formatReturnPct(myRank.returnPct)}
          </p>

          <p>
            최종 총자산: {formatAsset(myRank.totalAsset)}
          </p>
        </section>
      )}

      {isPractice && reveal && (
        <section>
          <h2>연습 종목 공개</h2>

          <p>
            실제 종목명: {reveal.name}
          </p>

          <p>
            종목 코드: {reveal.code}
          </p>

          <p>
            분석 기간: {reveal.period}
          </p>
        </section>
      )}

      <button type="button" onClick={() => navigate('/')}>
        홈으로 돌아가기
      </button>
    </main>
  )
}

export default Result
