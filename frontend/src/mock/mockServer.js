// 게임 서버 없이 화면을 개발하기 위한 가짜 서버 (VITE_MOCK=true)
// VITE_MOCK_MODE=practice 이면 연습 모드, 아니면 대결 모드
// 메시지 형식은 docs/protocol.md v0.3을 따른다

const BATTLE_STOCKS = {
  GANA: { name: '가나전자', price: 46000, sector: '반도체', eps: 4120, bps: 30000, sectorPer: 13 },
  DARA: { name: '다라항공', price: 19000, sector: '항공', eps: 1500, bps: 21000, sectorPer: 11 },
  MABA: { name: '마바게임즈', price: 32000, sector: '게임', eps: 1600, bps: 12000, sectorPer: 20 },
  SAAH: { name: '사아바이오', price: 54000, sector: '바이오', eps: 900, bps: 15000, sectorPer: 50 },
  JACHA: { name: '자차푸드', price: 27000, sector: '식품', eps: 2500, bps: 24000, sectorPer: 12 },
  KATA: { name: '카타에너지', price: 15000, sector: '에너지', eps: 1500, bps: 16000, sectorPer: 9 },
}

const PRACTICE_STOCKS = {
  STOCK_A: { name: '???', price: 10000, eps: 980, bps: 6890, sectorPer: 11 },
}

const players = [
  { playerId: 'p1', nickname: '나' },
  { playerId: 'p2', nickname: '투자왕' },
  { playerId: 'p3', nickname: '주린이' },
]

const HEADLINES = [
  { stock: 'GANA', headline: '가나전자, 차세대 칩 대형 수주 임박' },
  { stock: 'DARA', headline: '다라항공, 유가 급등에 실적 경고' },
  { stock: 'KATA', headline: '카타에너지, 정부 보조금 축소 검토' },
]

// 게임 서버 OrderBook과 같은 규칙: 5호가, 1호가 300만 원어치, 단계마다 1.5배
const tickSize = (price) => (price < 20000 ? 10 : price < 50000 ? 50 : 100)
const makeBook = (price) => {
  const unit = tickSize(price)
  const depth = (p, i) => Math.max(1, Math.floor((3_000_000 * 1.5 ** i) / p))
  const asks = []
  const bids = []
  for (let i = 0; i < 5; i += 1) {
    const ask = price + unit * (i + 1)
    const bid = price - unit * (i + 1)
    asks.push({ price: ask, qty: depth(ask, i) })
    bids.push({ price: bid, qty: depth(bid, i) })
  }
  return { asks, bids }
}

export const startMockServer = (emit, { mode = 'battle' } = {}) => {
  const isBattle = mode === 'battle'
  const STOCKS = isBattle ? BATTLE_STOCKS : PRACTICE_STOCKS
  const codes = Object.keys(STOCKS)
  const startCash = 10_000_000
  let t = 0
  let cash = startCash
  const holdings = {}
  const prices = Object.fromEntries(codes.map((code) => [code, STOCKS[code].price]))
  const books = {}
  const candleTicks = Object.fromEntries(codes.map((code) => [code, []]))
  const candleVolume = Object.fromEntries(codes.map((code) => [code, 0]))

  const roundTo = (value, unit) => Math.round(value / unit) * unit

  const portfolio = () => {
    const totalAsset =
      cash + Object.entries(holdings).reduce((sum, [code, h]) => sum + prices[code] * h.qty, 0)
    return {
      cash,
      holdings: JSON.parse(JSON.stringify(holdings)),
      totalAsset,
      returnPct: Number((((totalAsset - startCash) / startCash) * 100).toFixed(1)),
    }
  }

  const refreshBooks = () => {
    codes.forEach((code) => {
      books[code] = makeBook(prices[code])
    })
    emit('orderbook:update', { t, books: JSON.parse(JSON.stringify(books)) })
  }

  emit('room:update', {
    roomId: '482913',
    mode,
    hostId: 'p1',
    status: 'playing',
    players: isBattle ? players.map((p) => ({ ...p, connected: true })) : [{ ...players[0], connected: true }],
  })

  emit('game:start', {
    mode,
    durationSec: 600,
    startCash,
    rumorCards: isBattle ? 2 : 0,
    stocks: codes.map((code) => ({ code, name: STOCKS[code].name })),
  })

  emit('price:tick', { t: 0, prices: { ...prices } })
  emit('stock:info', {
    stocks: Object.fromEntries(
      codes.map((code) => {
        const { sector, eps, bps, sectorPer } = STOCKS[code]
        return [code, isBattle ? { sector, eps, bps, sectorPer } : { eps, bps, sectorPer }]
      }),
    ),
  })
  refreshBooks()
  emit('portfolio:update', portfolio())

  const timer = setInterval(() => {
    t += 1

    codes.forEach((code) => {
      const unit = tickSize(prices[code])
      const before = prices[code]
      prices[code] = Math.max(1000, roundTo(before * (1 + (Math.random() - 0.48) * 0.012), unit))
      candleTicks[code].push(prices[code])
      const change = Math.abs(prices[code] / before - 1)
      candleVolume[code] += Math.round((10_000_000 / STOCKS[code].price) * (0.6 + Math.random() * 0.8) * (1 + change / 0.004))
    })

    emit('price:tick', { t, prices: { ...prices } })
    refreshBooks()
    emit('portfolio:update', portfolio())

    if (isBattle) {
      const ranks = players
        .map((player) => ({
          ...player,
          returnPct: player.playerId === 'p1' ? portfolio().returnPct : Number((Math.random() * 10 - 3).toFixed(1)),
        }))
        .sort((a, b) => b.returnPct - a.returnPct)
        .map((player, index) => ({ ...player, rank: index + 1 }))
      emit('rank:update', { t, ranks })

      emit('market:flow', {
        t,
        windowSec: 10,
        buyRatio: Object.fromEntries(codes.map((code) => [code, Number((0.3 + Math.random() * 0.4).toFixed(2))])),
        impactPct: Object.fromEntries(codes.map((code) => [code, Number((Math.random() * 4 - 2).toFixed(1))])),
      })

      if (t % 20 === 0) {
        const news = HEADLINES[(t / 20) % HEADLINES.length]
        emit('news:push', { newsId: `n${t}`, t, ...news })
      }
    }

    if (t % 5 === 0) {
      emit('candle:close', {
        t,
        candles: Object.fromEntries(
          codes.map((code) => {
            const ticks = candleTicks[code]
            return [code, { o: ticks[0], h: Math.max(...ticks), l: Math.min(...ticks), c: ticks[ticks.length - 1], v: candleVolume[code] }]
          }),
        ),
      })
      codes.forEach((code) => {
        candleTicks[code] = []
        candleVolume[code] = 0
      })
    }

    if (t >= 600) {
      clearInterval(timer)
      emit('game:end', {
        ranks: [{ rank: 1, playerId: 'p1', nickname: '나', ...portfolio() }],
        rumors: [],
        reveal: isBattle
          ? null
          : { scenarioId: 'mock', name: '가상 종목', code: '000000', period: '가상 기간', fundamentals: { sector: '반도체', eps: 2340, bps: 16500, sectorPer: 11 } },
      })
    }
  }, 1000)

  // 화면의 요청(order:place)을 게임 서버처럼 처리: 호가를 차례로 먹으며 체결
  const request = (event, payload = {}) => {
    if (event !== 'order:place') return { ok: false, code: 'INTERNAL_ERROR', message: 'mock: unsupported request' }
    const { stock, side, qty } = payload
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, code: 'INVALID_QTY', message: 'invalid qty' }
    const book = books[stock]
    if (!book) return { ok: false, code: 'INVALID_STOCK', message: 'unknown stock' }
    const levels = side === 'buy' ? book.asks : book.bids
    const fills = []
    let left = qty
    for (const level of levels) {
      if (left === 0) break
      const take = Math.min(left, level.qty)
      if (take > 0) fills.push({ price: level.price, qty: take })
      left -= take
    }
    if (!fills.length) return { ok: false, code: 'NO_LIQUIDITY', message: 'no quantity left' }
    const filled = qty - left
    const amount = fills.reduce((sum, f) => sum + f.price * f.qty, 0)
    if (side === 'buy') {
      if (cash < amount) return { ok: false, code: 'NOT_ENOUGH_CASH', message: 'not enough cash' }
      const held = holdings[stock] ?? { qty: 0, avgPrice: 0 }
      holdings[stock] = { qty: held.qty + filled, avgPrice: Math.round((held.qty * held.avgPrice + amount) / (held.qty + filled)) }
      cash -= amount
    } else {
      const held = holdings[stock]
      if (!held || held.qty < filled) return { ok: false, code: 'NOT_ENOUGH_SHARES', message: 'not enough shares' }
      held.qty -= filled
      if (held.qty === 0) delete holdings[stock]
      cash += amount
    }
    fills.forEach((f) => {
      const level = levels.find((l) => l.price === f.price)
      level.qty -= f.qty
    })
    candleVolume[stock] += filled
    emit('orderbook:update', { t, books: { [stock]: JSON.parse(JSON.stringify(book)) } })
    emit('portfolio:update', portfolio())
    return { ok: true, price: Math.round(amount / filled), qty: filled, requestedQty: qty, fills, cash }
  }

  return { stop: () => clearInterval(timer), request }
}
