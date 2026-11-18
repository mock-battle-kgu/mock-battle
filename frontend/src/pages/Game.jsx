
import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import './Game.css'

const DEFAULT_STOCKS = [
  { code: 'GANA', name: '가나전자', price: 46000 },
  { code: 'DARA', name: '다라항공', price: 19000 },
  { code: 'MABA', name: '마바게임즈', price: 32000 },
  { code: 'SAAH', name: '사아바이오', price: 25000 },
  { code: 'JACHA', name: '자차푸드', price: 15000 },
  { code: 'KATA', name: '카타에너지', price: 38000 },
]

function Game({ gameState }) {
  const [selectedStock, setSelectedStock] = useState('GANA')
  const [chartHasData, setChartHasData] = useState(false)

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
                onClick={() => setSelectedStock(stock.code)}
              >
                <span className="stock-name">
                  {stock.name}
                </span>

                <strong>
                  {price?.toLocaleString()}원
                </strong>
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

        <span className="price-unit">
          실시간 현재가
        </span>
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
    </main>
  )
}

export default Game
