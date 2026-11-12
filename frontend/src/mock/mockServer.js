const STOCKS = {
  GANA: { name: '가나전자', price: 46000 },
  DARA: { name: '다라항공', price: 19000 },
  MABA: { name: '마바게임즈', price: 32000 },
  SAAH: { name: '사아바이오', price: 25000 },
  JACHA: { name: '자차푸드', price: 15000 },
  KATA: { name: '카타에너지', price: 38000 },
}

const players = [
  { playerId: 'p1', nickname: '나' },
  { playerId: 'p2', nickname: '투자왕' },
  { playerId: 'p3', nickname: '주린이' },
]

export const startMockServer = (emit) => {
  let t = 0
  let prices = Object.fromEntries(
    Object.entries(STOCKS).map(([code, stock]) => [code, stock.price]),
  )

  const startCash = 10000000
  const cash = startCash
  const holdings = {}

  emit('room:update', {
    roomId: '123456',
    hostId: 'p1',
    status: 'playing',
    players,
  })

  emit('game:start', {
    mode: 'battle',
    durationSec: 600,
    startCash,
    rumorCards: 2,
    stocks: Object.entries(STOCKS).map(([code, stock]) => ({
      code,
      name: stock.name,
      price: stock.price,
    })),
  })

  emit('portfolio:update', {
    cash,
    holdings,
    totalAsset: startCash,
    returnPct: 0,
  })

  const priceTimer = setInterval(() => {
    t += 1

    const previousPrices = { ...prices }

    Object.keys(prices).forEach((stock) => {
      const change = Math.round((Math.random() - 0.5) * 1000)
      prices[stock] = Math.max(1000, prices[stock] + change)
    })

    emit('price:tick', { t, prices })

    const totalAsset =
      cash +
      Object.entries(holdings).reduce(
        (total, [stock, holding]) =>
          total + prices[stock] * holding.qty,
        0,
      )

    emit('portfolio:update', {
      cash,
      holdings,
      totalAsset,
      returnPct: Number(
        (((totalAsset - startCash) / startCash) * 100).toFixed(1),
      ),
    })

    const ranks = players
      .map((player) => ({
        ...player,
        returnPct: Number((Math.random() * 10 - 3).toFixed(1)),
      }))
      .sort((a, b) => b.returnPct - a.returnPct)
      .map((player, index) => ({
        ...player,
        rank: index + 1,
      }))

    emit('rank:update', { t, ranks })

    const buyRatio = {}
    const impactPct = {}

    Object.keys(prices).forEach((stock) => {
      buyRatio[stock] = Number(Math.random().toFixed(2))
      impactPct[stock] = Number(((Math.random() * 4) - 2).toFixed(1))
    })

    emit('market:flow', {
      t,
      windowSec: 10,
      buyRatio,
      impactPct,
    })

    if (t % 5 === 0) {
      emit('candle:close', {
        t,
        candles: Object.fromEntries(
          Object.entries(prices).map(([stock, price]) => {
            const previous = previousPrices[stock]

            return [
              stock,
              {
                o: previous,
                h: Math.max(previous, price) + 200,
                l: Math.min(previous, price) - 200,
                c: price,
              },
            ]
          }),
        ),
      })
    }

    if (t % 15 === 0) {
      emit('news:push', {
        newsId: `news-${t}`,
        t,
        stock: 'GANA',
        headline: '시장 변동성 확대, 투자자 관심 집중',
      })
    }

    if (t >= 600) {
      emit('game:end', {
        ranks: ranks.map((player) => ({
          ...player,
          totalAsset: Math.round(
            startCash * (1 + player.returnPct / 100),
          ),
        })),
        rumors: [],
        reveal: null,
      })

      clearInterval(priceTimer)
    }
  }, 1000)

  return () => clearInterval(priceTimer)
}