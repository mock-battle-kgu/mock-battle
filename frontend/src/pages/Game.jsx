import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GameHeader from '../components/game/GameHeader'
import StockTabs from '../components/game/StockTabs'
import PriceChart from '../components/game/PriceChart'
import StockInfoCard from '../components/game/StockInfoCard'
import BuyPressure from '../components/game/BuyPressure'
import OrderBook from '../components/game/OrderBook'
import OrderPanel from '../components/game/OrderPanel'
import RankingPanel from '../components/game/RankingPanel'
import NewsPanel from '../components/game/NewsPanel'
import { TradeHistory, PracticeProgress } from '../components/game/PracticePanels'
import { changeClass, formatChangePct, formatWon } from '../utils/format'
import './Game.css'

const EMPTY = []

// 게임 화면 (v0.3): 대결 모드와 연습 모드가 같은 틀을 쓰고, 모드별로 패널만 바꾼다
function Game({ gameState, connectionStatus, rejoinStatus, placeOrder, leaveGame }) {
  const navigate = useNavigate()
  const [pickedStock, setPickedStock] = useState('GANA')
  const [profiles, setProfiles] = useState({}) // GET /api/stocks (대결 모드 업종·소개)

  const game = gameState.game
  const isBattle = game?.mode !== 'practice'
  const stocks = game?.stocks ?? EMPTY

  // 대결 모드 종목 소개는 한 번만 받아 온다 (실패해도 지표는 stock:info로 표시)
  useEffect(() => {
    if (!game || !isBattle) return
    let cancelled = false
    fetch('/api/stocks')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.stocks) return
        setProfiles(Object.fromEntries(data.stocks.map((s) => [s.code, s])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [game, isBattle])

  // 고른 종목이 이번 게임에 없으면(연습 모드 STOCK_A 등) 첫 종목을 선택
  const selected = stocks.some((s) => s.code === pickedStock) ? pickedStock : stocks[0]?.code
  const selectedInfo = stocks.find((s) => s.code === selected)
  const displayName = isBattle ? selectedInfo?.name : '??? 종목'

  const price = gameState.prices?.[selected]
  const basePrice = gameState.basePrices?.[selected]
  const changePct = price && basePrice ? ((price - basePrice) / basePrice) * 100 : null

  const holding = gameState.portfolio?.holdings?.[selected] ?? null
  const history = gameState.candleHistory?.[selected] ?? EMPTY

  const durationSec = game?.durationSec ?? 600
  const elapsed = gameState.elapsedTime ?? 0
  const remainingTime = Math.max(0, durationSec - elapsed)
  const totalDays = Math.round(durationSec / 5)
  const day = Math.min(totalDays, Math.floor(elapsed / 5))

  // 차트 시간축: 대결은 경과 시간, 연습은 D+거래일 (실제 날짜는 숨김)
  const formatTick = useCallback(
    (t) => {
      const sec = Number(t)
      if (!isBattle) return `D+${Math.ceil(sec / 5)}`
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    },
    [isBattle],
  )

  const playerCount = gameState.room?.players?.length ?? 0
  const myTrades = useMemo(
    () => (gameState.myTrades ?? EMPTY).filter((trade) => trade.stock === selected),
    [gameState.myTrades, selected],
  )

  const goHome = () => {
    leaveGame()
    navigate('/')
  }

  if (!game) {
    return (
      <main className="gm-page">
        <div className="gm-card gm-waiting">
          {rejoinStatus === 'pending' ? (
            <>
              <h1 className="gm-h2">이전 게임에 다시 연결하는 중</h1>
              <p className="gm-muted">새로고침 전의 잔고와 순위를 그대로 불러옵니다.</p>
            </>
          ) : (
            <>
              <h1 className="gm-h2">진행 중인 게임이 없어요</h1>
              <p className="gm-muted">
                {rejoinStatus === 'failed'
                  ? '이전 게임에 다시 들어갈 수 없습니다. 게임이 끝났거나 대기실에서 연결이 끊겼어요.'
                  : '시작 화면에서 방을 만들거나 입장해 주세요.'}
              </p>
              <button type="button" className="gm-home-btn" onClick={goHome}>시작 화면으로</button>
            </>
          )}
        </div>
      </main>
    )
  }

  const canOrder = connectionStatus === 'connected' || connectionStatus === 'mock'

  return (
    <main className="gm-page">
      <div className="gm-wrap">
        <GameHeader
          isBattle={isBattle}
          roomId={gameState.room?.roomId}
          playerCount={playerCount}
          remainingTime={remainingTime}
          totalAsset={gameState.portfolio?.totalAsset}
          returnPct={gameState.portfolio?.returnPct}
          connectionStatus={rejoinStatus === 'pending' ? 'reconnecting' : connectionStatus}
          progress={isBattle ? null : `거래일 ${day} / ${totalDays}`}
        />

        {isBattle && (
          <StockTabs
            stocks={stocks}
            prices={gameState.prices}
            basePrices={gameState.basePrices}
            selected={selected}
            onSelect={setPickedStock}
          />
        )}

        <div className="gm-grid">
          <div className="gm-main">
            <section aria-label="차트" className="gm-card gm-chart-card">
              <div className="gm-chart-head">
                <h1 className="gm-stock-title">{displayName}</h1>
                <span className="gm-stock-price">{formatWon(price)}</span>
                <span className={`gm-stock-change ${changeClass(changePct)}`}>
                  {formatChangePct(changePct)}
                  {!isBattle && <span className="gm-muted gm-small"> 시작가 대비</span>}
                </span>
                <div className="gm-legend">
                  <span><i className="ma5" />MA5</span>
                  <span><i className="ma20" />MA20</span>
                  <span><i className="avg" />내 평단</span>
                  <span>{isBattle ? '5초 캔들' : '캔들 1개 = 실제 하루'}</span>
                </div>
              </div>
              <PriceChart history={history} avgPrice={holding?.avgPrice ?? null} formatTick={formatTick} />
            </section>

            <div className="gm-two">
              <StockInfoCard
                isBattle={isBattle}
                name={selectedInfo?.name}
                info={gameState.stockInfo?.[selected] ?? null}
                profile={profiles[selected]}
                price={price}
              />
              {isBattle ? (
                <BuyPressure name={selectedInfo?.name} flow={gameState.marketFlow} stock={selected} playerCount={playerCount} />
              ) : (
                <TradeHistory trades={myTrades} />
              )}
            </div>
          </div>

          <div className="gm-col">
            <OrderBook book={gameState.orderBooks?.[selected] ?? null} price={price} changePct={changePct} isBattle={isBattle} />
            {isBattle && (
              <OrderPanel
                key={selected}
                stockName={displayName}
                stockCode={selected}
                holding={holding}
                price={price}
                book={gameState.orderBooks?.[selected]}
                canOrder={canOrder}
                onOrder={placeOrder}
                note="현재가가 아니라 매도 1호가부터 차례로 체결됩니다."
              />
            )}
          </div>

          <div className="gm-col">
            {isBattle ? (
              <>
                <RankingPanel ranks={gameState.ranks ?? EMPTY} playerId={gameState.playerId} />
                <NewsPanel news={gameState.news ?? EMPTY} elapsedTime={elapsed} rumorCards={game.rumorCards ?? 0} />
              </>
            ) : (
              <>
                <OrderPanel
                  key={selected}
                  stockName={displayName}
                  stockCode={selected}
                  holding={holding}
                  price={price}
                  book={gameState.orderBooks?.[selected]}
                  canOrder={canOrder}
                  onOrder={placeOrder}
                  note="혼자 하는 블라인드 모드라 순위·루머·매수 압력 게이지는 없습니다."
                />
                <PracticeProgress day={day} totalDays={totalDays} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default Game
