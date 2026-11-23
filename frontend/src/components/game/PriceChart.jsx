import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import { movingAverage } from '../../utils/indicators'

const UP = '#F04452'
const DOWN = '#3182F6'

// 캔들 + 이동평균선(MA5·MA20) + 거래량 막대 + 내 평단 점선
// history: [{ t, o, h, l, c, v }], t는 게임 경과 초
function PriceChart({ history, avgPrice, formatTick }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const formatRef = useRef(formatTick)

  useEffect(() => {
    formatRef.current = formatTick
  }, [formatTick])

  // 차트는 한 번만 만든다
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 360,
      layout: { background: { color: 'transparent' }, textColor: '#9AA4B2', fontFamily: 'inherit' },
      grid: { vertLines: { color: '#1F2939' }, horzLines: { color: '#222C3D' } },
      rightPriceScale: { borderColor: '#263247', scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: {
        borderColor: '#263247',
        barSpacing: 9, // 캔들이 적을 때 너무 넓어지지 않게 고정 간격
        rightOffset: 4,
        tickMarkFormatter: (time) => formatRef.current(time),
      },
      localization: {
        timeFormatter: (time) => formatRef.current(time),
        priceFormatter: (price) => Math.round(price).toLocaleString('ko-KR'),
      },
      crosshair: { horzLine: { color: '#4B5A73' }, vertLine: { color: '#4B5A73' } },
    })

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    })
    const ma5 = chart.addSeries(LineSeries, {
      color: '#F5A623', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })
    const ma20 = chart.addSeries(LineSeries, {
      color: '#A78BFA', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })
    // 거래량은 차트 아래 20%에 따로 그린다
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartRef.current = chart
    seriesRef.current = { candles, ma5, ma20, volume }

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // 종목이 바뀌거나 캔들이 닫힐 때마다 다시 그린다 (한 판 최대 120개라 가볍다)
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    series.candles.setData(history.map((k) => ({ time: k.t, open: k.o, high: k.h, low: k.l, close: k.c })))
    series.ma5.setData(movingAverage(history, 5))
    series.ma20.setData(movingAverage(history, 20))
    series.volume.setData(
      history.map((k) => ({
        time: k.t,
        value: k.v ?? 0,
        color: k.c >= k.o ? 'rgba(240, 68, 82, 0.55)' : 'rgba(49, 130, 246, 0.55)',
      })),
    )
  }, [history])

  // 종목을 바꾸면 가장 최근 캔들로 이동한다
  const firstTime = history[0]?.t
  useEffect(() => {
    if (firstTime !== undefined) chartRef.current?.timeScale().scrollToRealTime()
  }, [firstTime])

  // 보유 중이면 평단가를 점선으로
  useEffect(() => {
    const candles = seriesRef.current?.candles
    if (!candles || !avgPrice) return undefined
    const line = candles.createPriceLine({
      price: avgPrice,
      color: '#34D399',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '내 평단',
    })
    return () => {
      if (seriesRef.current?.candles === candles) candles.removePriceLine(line)
    }
  }, [avgPrice])

  return (
    <div className="chart-box">
      <div ref={containerRef} className="chart-canvas" />
      {history.length === 0 && <div className="chart-empty">첫 캔들을 기다리는 중 (5초마다 하나씩 생겨요)</div>}
    </div>
  )
}

export default PriceChart
