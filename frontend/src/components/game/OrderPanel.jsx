import { useState } from 'react'
import { changeClass, formatNumber, formatWon } from '../../utils/format'
import { estimateFill } from '../../utils/indicators'

const ERROR_MESSAGES = {
  NOT_ENOUGH_CASH: '현금이 부족합니다.',
  NOT_ENOUGH_SHARES: '보유 수량이 부족합니다.',
  INVALID_QTY: '주문 수량을 확인해 주세요.',
  INVALID_STOCK: '이 게임에 없는 종목입니다.',
  NO_LIQUIDITY: '호가 잔량이 없습니다. 잠시 후 다시 주문하세요.',
  GAME_NOT_PLAYING: '게임 진행 중에만 주문할 수 있습니다.',
  SERVER_DISCONNECTED: '서버에 연결되어 있지 않습니다.',
  REQUEST_TIMEOUT: '서버 응답 시간이 초과되었습니다.',
}

// 주문창: 호가 기준 예상 금액, 체결 알림(평균 체결가·호가별 내역)
function OrderPanel({ stockName, stockCode, holding, price, book, canOrder, onOrder, note }) {
  const [quantity, setQuantity] = useState('10')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState(null)

  const qty = Number(quantity)
  const validQty = Number.isInteger(qty) && qty > 0
  const estimate = validQty ? estimateFill(book, 'buy', qty, price) : null
  const pnl = holding ? (price - holding.avgPrice) * holding.qty : null

  const changeQty = (delta) => {
    setQuantity((prev) => String(Math.max(1, (Number(prev) || 0) + delta)))
    setMessage(null)
  }

  const submit = async (side) => {
    if (!validQty || pending || !canOrder) return
    setPending(true)
    setMessage(null)
    const response = await onOrder({ stock: stockCode, side, qty })
    setPending(false)
    if (!response?.ok) {
      setMessage({ type: 'error', title: ERROR_MESSAGES[response?.code] || response?.message || '주문 처리에 실패했습니다.' })
      return
    }
    const sideText = side === 'buy' ? '매수' : '매도'
    const partial = response.requestedQty && response.qty < response.requestedQty
    setMessage({
      type: 'success',
      title: `${sideText} ${formatNumber(response.qty)}주 체결 · 평균 ${formatWon(response.price)}`,
      detail: [
        partial ? `요청 ${formatNumber(response.requestedQty)}주 중 ${formatNumber(response.qty)}주 체결 (호가 잔량 부족)` : null,
        response.fills?.length
          ? response.fills.map((f) => `${formatWon(f.price)} × ${formatNumber(f.qty)}주`).join(' · ')
          : null,
      ].filter(Boolean),
    })
  }

  const disabled = !validQty || pending || !canOrder

  return (
    <section aria-label="주문" className="gm-card gm-panel">
      <h2 className="gm-h2">주문 · {stockName}</h2>
      <div className="gm-kv">
        <span className="gm-muted">보유</span>
        <span>{holding ? `${formatNumber(holding.qty)}주 · 평균 ${formatWon(holding.avgPrice)}` : '없음'}</span>
      </div>
      <div className="gm-kv">
        <span className="gm-muted">평가손익</span>
        <strong className={changeClass(pnl)}>
          {pnl === null ? '—' : `${pnl > 0 ? '▲ +' : pnl < 0 ? '▼ ' : ''}${formatWon(Math.abs(pnl))}`}
        </strong>
      </div>

      <label htmlFor="order-qty" className="gm-muted gm-small">수량</label>
      <div className="gm-qty">
        <button type="button" aria-label="수량 줄이기" onClick={() => changeQty(-1)}>−</button>
        <input
          id="order-qty"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value.replace(/[^0-9]/g, ''))
            setMessage(null)
          }}
        />
        <button type="button" aria-label="수량 늘리기" onClick={() => changeQty(1)}>+</button>
      </div>
      <div className="gm-kv gm-small">
        <span className="gm-muted">예상 금액 (호가 기준)</span>
        <span>{estimate ? formatWon(estimate.amount) : '—'}</span>
      </div>
      <div className="gm-kv gm-small">
        <span className="gm-muted">예상 평균 체결가</span>
        <span>{estimate?.avg ? `${formatWon(estimate.avg)} (${estimate.levels}호가)` : '—'}</span>
      </div>

      <div className="gm-order-buttons">
        <button type="button" className="buy" disabled={disabled} onClick={() => submit('buy')}>
          {pending ? '처리 중' : '매수'}
        </button>
        <button type="button" className="sell" disabled={disabled} onClick={() => submit('sell')}>
          {pending ? '처리 중' : '매도'}
        </button>
      </div>

      {message && (
        <div role="status" className={`gm-toast ${message.type}`}>
          <strong>{message.title}</strong>
          {message.detail?.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}
      <p className="gm-note">{note}</p>
    </section>
  )
}

export default OrderPanel
