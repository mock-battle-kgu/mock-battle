
import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { socket } from '../socket/socket'
import './Game.css'

const DEFAULT_STOCKS = [
  { code: 'GANA', name: '가나전자', price: 46000 },
  { code: 'DARA', name: '다라항공', price: 19000 },
  { code: 'MABA', name: '마바게임즈', price: 32000 },
  { code: 'SAAH', name: '사아바이오', price: 25000 },
  { code: 'JACHA', name: '자차푸드', price: 15000 },
  { code: 'KATA', name: '카타에너지', price: 38000 },
]

const ERROR_MESSAGES = {
  NOT_ENOUGH_CASH: '현금이 부족합니다.',
  NOT_ENOUGH_SHARES: '보유 수량이 부족합니다.',
  INVALID_QTY: '주문 수량을 확인해 주세요.',
  GAME_NOT_PLAYING: '게임 진행 중에만 주문할 수 있습니다.',
  SERVER_DISCONNECTED: '서버에 연결되어 있지 않습니다.',
  REQUEST_TIMEOUT: '서버 응답 시간이 초과되었습니다.',
}

const formatWon = (value) =>
  Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString('ko-KR')}원`
    : '—'

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`
}

const formatReturn = (value) => {
  const number = Number(value)

  if (!Number.isFinite(number)) return '—'

  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`
}

function Game({ gameState }) {
  const [selectedStock, setSelectedStock] = useState('GANA')
  const [chartHasData, setChartHasData] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [orderMessageType, setOrderMessageType] = useState('')

  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)

  const candleHistoryRef = useRef({})
  const lastCandleTimeRef = useRef({})
  const chartTimeBaseRef = useRef(null)

  const stocks = gameState?.game?.stocks?.length
    ? gameState.game.stocks
    : DEFAULT_STOCKS

  const selectedInfo =
    stocks.find((stock) => stock.code === selectedStock) || stocks[0]

  const currentPrice =
    gameState?.prices?.[selectedStock] ?? selectedInfo?.price ?? 0

  const basePrice = selectedInfo?.price ?? currentPrice
  const change = currentPrice - basePrice
  const changePct = basePrice
    ? (change / basePrice) * 100
    : 0

  const portfolio = gameState?.portfolio
  const cash = portfolio?.cash
  const holdings = portfolio?.holdings
  const selectedHolding = holdings?.[selectedStock]
  const holdingQuantity = selectedHolding?.qty ?? 0

  const parsedQuantity = Number(quantity)
  const validQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity > 0

  const roomId = gameState?.room?.roomId

  // 순위 및 남은 시간
  const ranks = gameState?.ranks ?? []
  const playerId = gameState?.playerId
  const durationSec = gameState?.game?.durationSec ?? 600
  const elapsedTime = gameState?.rankElapsedTime ?? 0
  const remainingTime = Math.max(0, durationSec - elapsedTime)

  const sortedRanks = [...ranks].sort(
    (a, b) => Number(a.rank) - Number(b.rank),
  )

  const placeOrder = (side) => {
    if (!validQuantity || isOrdering || !roomId || !socket.connected) {
      return
    }

    setIsOrdering(true)
    setOrderMessage('')
    setOrderMessageType('')

    const payload = {
      roomId,
      stock: selectedStock,
      side,
      qty: parsedQuantity,
    }

    socket.timeout(5000).emit('order:place', payload, (error, response) => {
      setIsOrdering(false)

      if (error) {
        setOrderMessage(ERROR_MESSAGES.REQUEST_TIMEOUT)
        setOrderMessageType('error')
        return
      }

      if (!response?.ok) {
        const code = response?.code
        setOrderMessage(
          ERROR_MESSAGES[code] ||
            response?.message ||
            '주문 처리에 실패했습니다.',
        )
        setOrderMessageType('error')
        return
      }

      setOrderMessage(
        side === 'buy'
          ? '매수 주문이 완료되었습니다.'
          : '매도 주문이 완료되었습니다.',
      )
      setOrderMessageType('success')
    })
  }

  // 차트 생성
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // 선택한 종목의 캔들 표시
  useEffect(() => {
    if (!chartRef.current || !selectedStock) return

    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current)
    }

    const series = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#2563eb',
      borderUpColor: '#ef4444',
      borderDownColor: '#2563eb',
      wickUpColor: '#ef4444',
      wickDownColor: '#2563eb',
    })

    seriesRef.current = series

    const history = candleHistoryRef.current[selectedStock] || []

    series.setData(history)
    chartRef.current.timeScale().fitContent()

    setChartHasData(history.length > 0)
  }, [selectedStock])

  // 서버에서 받은 캔들 데이터 반영
  useEffect(() => {
    const candles = gameState?.candles
    const candleElapsedTime = gameState?.candleTime

    if (
      !candles ||
      Object.keys(candles).length === 0 ||
      !Number.isFinite(candleElapsedTime)
    ) {
      return
    }

    if (chartTimeBaseRef.current === null) {
      chartTimeBaseRef.current =
        Math.floor(Date.now() / 1000) - candleElapsedTime
    }

    const chartTime = chartTimeBaseRef.current + candleElapsedTime

    Object.entries(candles).forEach(([code, candle]) => {
      if (
        !candle ||
        !Number.isFinite(candle.o) ||
        !Number.isFinite(candle.h) ||
        !Number.isFinite(candle.l) ||
        !Number.isFinite(candle.c)
      ) {
        return
      }

      const previousTime = lastCandleTimeRef.current[code]

      if (
        previousTime !== undefined &&
        candleElapsedTime < previousTime
      ) {
        return
      }

      const history = candleHistoryRef.current[code] || []

      const newCandle = {
        time: chartTime,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
      }

      if (candleElapsedTime === previousTime) {
        if (history.length > 0) {
          history[history.length - 1] = newCandle
        }
      } else {
        history.push(newCandle)
      }

      candleHistoryRef.current[code] = history
      lastCandleTimeRef.current[code] = candleElapsedTime

      if (code === selectedStock && seriesRef.current) {
        seriesRef.current.update(newCandle)
        setChartHasData(history.length > 0)
      }
    })
  }, [gameState?.candleTime, selectedStock])

  return (
    <main className="game-page">
      <header className="game-header">
        <div>
          <p className="game-label">MOCK INVESTMENT BATTLE</p>
          <h1>실시간 투자 게임</h1>
        </div>

        <div
          className="game-timer"
          style={{
            textAlign: 'center',
            minWidth: '90px',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            남은 시간
          </span>
          <strong
            style={{
              fontSize: '24px',
              fontVariantNumeric: 'tabular-nums',
              color: remainingTime <= 60 ? '#dc2626' : 'inherit',
            }}
          >
            {formatTime(remainingTime)}
          </strong>
        </div>
      </header>

      <section
        className="ranking-section"
        style={{
          marginTop: '24px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0 }}>실시간 순위</h2>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            1초마다 갱신
          </span>
        </div>

        {sortedRanks.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: '24px 0',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            순위 데이터 수신 대기 중
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <thead>
                <tr
                  style={{
                    color: '#64748b',
                    fontSize: '13px',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <th style={{ padding: '12px 8px' }}>순위</th>
                  <th style={{ padding: '12px 8px' }}>플레이어</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>
                    수익률
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRanks.map((rank) => {
                  const isMe =
                    playerId != null &&
                    rank.playerId === playerId

                  const returnPct = Number(rank.returnPct)
                  const isPositive = returnPct >= 0

                  return (
                    <tr
                      key={rank.playerId}
                      style={{
                        background: isMe ? '#eff6ff' : '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: isMe ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: '14px 8px' }}>
                        {rank.rank}위
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        {rank.nickname}
                        {isMe && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              fontSize: '12px',
                            }}
                          >
                            나
                          </span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: '14px 8px',
                          textAlign: 'right',
                          color: Number.isFinite(returnPct)
                            ? isPositive
                              ? '#dc2626'
                              : '#2563eb'
                            : '#64748b',
                        }}
                      >
                        {formatReturn(rank.returnPct)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stock-section">
        <h2>종목 선택</h2>

        <div className="stock-tabs">
          {stocks.map((stock) => {
            const price =
              gameState?.prices?.[stock.code] ?? stock.price

            return (
              <button
                key={stock.code}
                type="button"
                className={`stock-tab ${
                  selectedStock === stock.code ? 'active' : ''
                }`}
                onClick={() => {
                  setSelectedStock(stock.code)
                  setOrderMessage('')
                }}
              >
                <span className="stock-name">{stock.name}</span>
                <strong>{price?.toLocaleString()}원</strong>
              </button>
            )
          })}
        </div>
      </section>

      <section className="price-section">
        <div>
          <span className="price-stock-name">
            {selectedInfo?.name}
          </span>

          <h2>{currentPrice.toLocaleString()}원</h2>

          <p className={change >= 0 ? 'price-up' : 'price-down'}>
            {change > 0 ? '+' : ''}
            {change.toLocaleString()}원
            ({changePct > 0 ? '+' : ''}
            {changePct.toFixed(2)}%)
          </p>
        </div>

        <span className="price-unit">실시간 현재가</span>
      </section>

      <section className="chart-section">
        <div className="section-heading">
          <h2>주가 차트</h2>
          <span>5초 단위 캔들</span>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
          }}
        >
          <div
            className="chart-container"
            ref={chartContainerRef}
          />

          {!chartHasData && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '14px',
                pointerEvents: 'none',
              }}
            >
              캔들 데이터 수신 대기 중
            </div>
          )}
        </div>
      </section>

      <section
        className="order-section"
        style={{
          marginTop: '24px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <h2 style={{ marginTop: 0 }}>주문하기</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              주문 종목
            </p>
            <strong>{selectedInfo?.name}</strong>
          </div>

          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              주문 가격
            </p>
            <strong>{formatWon(currentPrice)}</strong>
          </div>

          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              보유 수량
            </p>
            <strong>
              {Number(holdingQuantity).toLocaleString('ko-KR')}주
            </strong>
          </div>
        </div>

        <label
          htmlFor="order-quantity"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 600,
          }}
        >
          주문 수량
        </label>

        <input
          id="order-quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value)
            setOrderMessage('')
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            type="button"
            disabled={!validQuantity || isOrdering || !roomId || !socket.connected}
            onClick={() => placeOrder('buy')}
            style={{
              flex: 1,
              padding: '14px',
              border: 0,
              borderRadius: '8px',
              color: '#ffffff',
              background: '#ef4444',
              cursor: 'pointer',
              opacity:
                !validQuantity || isOrdering || !roomId || !socket.connected
                  ? 0.5
                  : 1,
            }}
          >
            {isOrdering ? '주문 처리 중' : '매수'}
          </button>

          <button
            type="button"
            disabled={!validQuantity || isOrdering || !roomId || !socket.connected}
            onClick={() => placeOrder('sell')}
            style={{
              flex: 1,
              padding: '14px',
              border: 0,
              borderRadius: '8px',
              color: '#ffffff',
              background: '#2563eb',
              cursor: 'pointer',
              opacity:
                !validQuantity || isOrdering || !roomId || !socket.connected
                  ? 0.5
                  : 1,
            }}
          >
            {isOrdering ? '주문 처리 중' : '매도'}
          </button>
        </div>

        {orderMessage && (
          <p
            role="status"
            style={{
              marginBottom: 0,
              color: orderMessageType === 'error' ? '#dc2626' : '#16a34a',
            }}
          >
            {orderMessage}
          </p>
        )}
      </section>

      <section
        className="portfolio-section"
        style={{
          marginTop: '24px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#ffffff',
        }}
      >
        <h2 style={{ marginTop: 0 }}>내 잔고</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              보유 현금
            </p>
            <strong>{cash == null ? '—' : formatWon(cash)}</strong>
          </div>

          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              보유 종목
            </p>
            <strong>
              {selectedInfo?.name} {Number(holdingQuantity).toLocaleString('ko-KR')}주
            </strong>
          </div>

          <div>
            <p style={{ color: '#64748b', marginBottom: '6px' }}>
              총자산
            </p>
            <strong>
              {portfolio?.totalAsset == null
                ? '—'
                : formatWon(portfolio.totalAsset)}
            </strong>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Game
