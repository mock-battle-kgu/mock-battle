import { changeClass, formatChangePct, formatNumber } from '../../utils/format'

// 호가창: 매도 5호가(위, 비싼 것부터) · 현재가 · 매수 5호가(아래)
function OrderBook({ book, price, changePct, isBattle }) {
  if (!book) {
    return (
      <section aria-label="호가창" className="gm-card gm-book">
        <h2 className="gm-h2 gm-pad">호가</h2>
        <p className="gm-empty">호가를 기다리는 중</p>
      </section>
    )
  }
  const asks = [...book.asks].reverse()
  const maxQty = Math.max(1, ...book.asks.map((l) => l.qty), ...book.bids.map((l) => l.qty))
  const unit = book.asks.length > 1 ? book.asks[1].price - book.asks[0].price : null

  const row = (level, side) => (
    <div key={`${side}-${level.price}`} className={`gm-book-row ${level.qty === 0 ? 'dim' : ''}`}>
      <div className={`gm-book-bar ${side}`} style={{ width: `${Math.round((level.qty / maxQty) * 50)}%` }} />
      {side === 'ask' ? (
        <>
          <span className="qty">{formatNumber(level.qty)}</span>
          <span className="price ask">{formatNumber(level.price)}</span>
          <span />
        </>
      ) : (
        <>
          <span />
          <span className="price bid">{formatNumber(level.price)}</span>
          <span className="qty left">{formatNumber(level.qty)}</span>
        </>
      )}
    </div>
  )

  return (
    <section aria-label="호가창" className="gm-card gm-book">
      <div className="gm-row gm-pad">
        <h2 className="gm-h2">호가</h2>
        {unit && <span className="gm-muted gm-small">호가 단위 {formatNumber(unit)}원</span>}
      </div>
      <div className="gm-book-head">
        <span>매도 잔량</span>
        <span>가격</span>
        <span>매수 잔량</span>
      </div>
      {asks.map((level) => row(level, 'ask'))}
      <div className="gm-book-now">
        <span className="gm-muted gm-small">현재가</span>
        <strong>{formatNumber(price)}</strong>
        <span className={changeClass(changePct)}>{formatChangePct(changePct)}</span>
      </div>
      {book.bids.map((level) => row(level, 'bid'))}
      <p className="gm-note gm-pad">
        {isBattle ? '잔량은 방 전체가 함께 씁니다. 1초마다 다시 채워집니다.' : '많이 사면 다음 호가로 넘어갑니다. 잔량은 1초마다 다시 채워집니다.'}
      </p>
    </section>
  )
}

export default OrderBook
