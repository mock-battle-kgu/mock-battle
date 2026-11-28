// 금액·수익률·시간 표시 함수 (화면은 계산하지 않고 받은 값을 보여주기만 한다)
const isNum = (value) => value !== null && value !== undefined && Number.isFinite(Number(value))

export const formatNumber = (value) => (isNum(value) ? Number(value).toLocaleString('ko-KR') : '—')

export const formatWon = (value) => (isNum(value) ? `${Number(value).toLocaleString('ko-KR')}원` : '—')

// 상승은 ▲ +, 하락은 ▼ (색만으로 구분하지 않기)
export const formatChangePct = (value, digits = 1) => {
  if (!isNum(value)) return '—'
  const number = Number(value)
  if (number > 0) return `▲ +${number.toFixed(digits)}%`
  if (number < 0) return `▼ ${Math.abs(number).toFixed(digits)}%`
  return `${number.toFixed(digits)}%`
}

export const changeClass = (value) => {
  const number = Number(value)
  if (number > 0) return 'up'
  if (number < 0) return 'down'
  return 'flat'
}

export const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export const formatRatio = (value, digits = 1) => (isNum(value) ? `${Number(value).toFixed(digits)}배` : '—')
