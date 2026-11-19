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

function Game({ gameState }) {
  const [pickedStock, setSelectedStock] = useState('GANA')
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

  // 고른 종목이 이번 게임에 없으면(연습 모드 STOCK_A 등) 첫 종목을 선택
  const selectedStock = stocks.some((stock) => stock.code === pickedStock)
    ? pickedStock
    : stocks[0]?.code

  const selectedInfo =
    stocks.find((stock) => stock.code === selectedStock) || stocks[0]

  const currentPrice =
    gameState?.prices?.[selectedStock] ?? selectedInfo?.price ?? 0

  // 기준가: game:start의 가격 → 없으면 처음 받은 시세(t=0 시작가)
  const basePrice =
    selectedInfo?.price ??
    gameState?.basePrices?.[selectedStock] ??
    currentPrice
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
        side === 'buy' ? '매수 주문이 완료되었습니다.' : '매도 주문이 완료되었습니다.',
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
    const elapsedTime = gameState?.candleTime

    if (
      !candles ||
      Object.keys(candles).length === 0 ||
      !Number.isFinite(elapsedTime)
    ) {
      return
    }

    if (chartTimeBaseRef.current === null) {
      chartTimeBaseRef.current =
        Math.floor(Date.now() / 1000) - elapsedTime
    }

    const chartTime = chartTimeBaseRef.current + elapsedTime

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
        elapsedTime < previousTime
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

      if (elapsedTime === previousTime) {
        if (history.length > 0) {
          history[history.length - 1] = newCandle
        }
      } else {
        history.push(newCandle)
      }

      candleHistoryRef.current[code] = history
      lastCandleTimeRef.current[code] = elapsedTime

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

        <span className="game-timer">LIVE</span>
      </header>

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
            <strong>{Number(holdingQuantity).toLocaleString('ko-KR')}주</strong>
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
