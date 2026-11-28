// 차트 보조 지표와 호가 계산 (표시용)

// 이동평균선: 캔들 종가 n개의 평균
export const movingAverage = (history, n) =>
  history.slice(n - 1).map((candle, i) => ({
    time: candle.t,
    value: history.slice(i, i + n).reduce((sum, c) => sum + c.c, 0) / n,
  }))

// 매도호가를 차례로 더해 qty주를 샀을 때의 예상 금액·평균가 (호가창이 없으면 현재가로)
export const estimateFill = (book, side, qty, fallbackPrice) => {
  if (!Number.isInteger(qty) || qty <= 0) return null
  const levels = side === 'buy' ? book?.asks : book?.bids
  if (!levels?.length) {
    return fallbackPrice ? { amount: fallbackPrice * qty, avg: fallbackPrice, levels: 1, filled: qty } : null
  }
  let left = qty
  let amount = 0
  let used = 0
  for (const level of levels) {
    if (left === 0) break
    const take = Math.min(left, level.qty)
    if (take > 0) {
      amount += take * level.price
      left -= take
      used += 1
    }
  }
  const filled = qty - left
  if (filled === 0) return { amount: 0, avg: null, levels: 0, filled: 0 }
  return { amount, avg: Math.round(amount / filled), levels: used, filled }
}

// PER이 업종 평균의 0.9배 미만이면 저평가, 1.1배 초과면 고평가
export const valuation = (per, sectorPer) => {
  if (!Number.isFinite(per) || !Number.isFinite(sectorPer) || sectorPer <= 0) return null
  if (per < sectorPer * 0.9) return 'low'
  if (per > sectorPer * 1.1) return 'high'
  return 'fair'
}
