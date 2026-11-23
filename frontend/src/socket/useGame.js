import { useEffect, useRef, useState } from 'react'
import { socket, connectSocket, disconnectSocket } from './socket'
import { saveSession, loadSession, clearSession } from './session'
import { startMockServer } from '../mock/mockServer'

const INITIAL_STATE = {
  room: null,
  game: null,
  prices: {},
  basePrices: {}, // 종목별 시작가 (등락률 기준)
  candleHistory: {}, // 종목별 캔들 기록 [{ t, o, h, l, c, v }]
  candleTime: null,
  portfolio: null,
  ranks: [],
  elapsedTime: 0, // 게임 경과 시간 (price:tick의 t)
  playerId: null,
  news: [],
  marketFlow: null,
  stockInfo: null, // 종목 지표 (stock:info)
  orderBooks: {}, // 종목별 호가창 (orderbook:update)
  myTrades: [], // 내 체결 내역 (최근 것부터)
  result: null,
}

const resetGameData = {
  game: null,
  prices: {},
  basePrices: {},
  candleHistory: {},
  candleTime: null,
  portfolio: null,
  ranks: [],
  elapsedTime: 0,
  news: [],
  marketFlow: null,
  stockInfo: null,
  orderBooks: {},
  myTrades: [],
  result: null,
}

// candle:close 하나를 종목별 기록에 붙인다 (같은 t면 덮어씀)
const appendCandles = (history, t, candles) => {
  const next = { ...history }
  Object.entries(candles || {}).forEach(([code, candle]) => {
    if (!candle || !Number.isFinite(candle.c)) return
    const list = next[code] ? [...next[code]] : []
    const item = { t, o: candle.o, h: candle.h, l: candle.l, c: candle.c, v: candle.v ?? 0 }
    if (list.length && list[list.length - 1].t === t) list[list.length - 1] = item
    else if (!list.length || list[list.length - 1].t < t) list.push(item)
    next[code] = list
  })
  return next
}

export const useGame = () => {
  const isMock = import.meta.env.VITE_MOCK === 'true'

  const [connectionStatus, setConnectionStatus] = useState(
    isMock ? 'mock' : 'disconnected',
  )
  // 새로고침 뒤 이전 게임에 다시 붙는 중인지 ('pending' | 'failed' | 'idle')
  const [rejoinStatus, setRejoinStatus] = useState(() =>
    !isMock && loadSession() ? 'pending' : 'idle',
  )

  // Mock 서버에서는 내가 p1
  const [gameState, setGameState] = useState(() =>
    isMock ? { ...INITIAL_STATE, playerId: 'p1' } : INITIAL_STATE,
  )
  const mockRequestRef = useRef(null)

  useEffect(() => {
    const handlers = {
      'room:update': (data) => {
        setGameState((prev) => ({
          ...prev,
          room: {
            ...prev.room,
            ...data,
          },
        }))
      },

      'game:start': (data) => {
        setGameState((prev) => ({
          ...prev,
          ...resetGameData,
          game: data,
        }))
      },

      // 재접속: 지금 게임 상태를 한 번에 받아 다시 만든다
      'game:resume': (data) => {
        let history = {}
        ;(data.candles || []).forEach((closed) => {
          history = appendCandles(history, closed.t, closed.candles)
        })
        const basePrices = { ...data.prices }
        Object.entries(history).forEach(([code, list]) => {
          if (list.length) basePrices[code] = list[0].o
        })
        setGameState((prev) => ({
          ...prev,
          ...resetGameData,
          game: {
            mode: data.mode,
            durationSec: data.durationSec,
            startCash: data.startCash,
            rumorCards: data.rumorCards,
            stocks: data.stocks,
          },
          prices: data.prices || {},
          basePrices,
          candleHistory: history,
          candleTime: data.candles?.length ? data.candles[data.candles.length - 1].t : null,
          elapsedTime: Number.isFinite(data.t) ? data.t : 0,
          portfolio: data.portfolio,
          stockInfo: data.stockInfo,
          orderBooks: data.books || {},
        }))
        setRejoinStatus('idle')
      },

      'price:tick': (data) => {
        setGameState((prev) => ({
          ...prev,
          prices: data.prices,
          // 남은 시간 계산용: 모든 모드에서 매초 오는 price:tick의 t를 사용
          elapsedTime: Number.isFinite(data.t) ? data.t : prev.elapsedTime,
          // t=0 시작가를 기준가로 저장하고, 이후에는 처음 받은 가격을 유지
          basePrices:
            data.t === 0
              ? data.prices
              : { ...data.prices, ...prev.basePrices },
        }))
      },

      'candle:close': (data) => {
        setGameState((prev) => ({
          ...prev,
          candleHistory: appendCandles(prev.candleHistory, data.t, data.candles),
          candleTime: data.t,
        }))
      },

      'portfolio:update': (data) => {
        setGameState((prev) => ({
          ...prev,
          portfolio: data,
        }))
      },

      'rank:update': (data) => {
        setGameState((prev) => ({
          ...prev,
          ranks: data.ranks,
        }))
      },

      'news:push': (data) => {
        setGameState((prev) => ({
          ...prev,
          news: [...prev.news, data],
        }))
      },

      'market:flow': (data) => {
        setGameState((prev) => ({
          ...prev,
          marketFlow: data,
        }))
      },

      'stock:info': (data) => {
        setGameState((prev) => ({
          ...prev,
          stockInfo: data.stocks,
        }))
      },

      // 1초마다는 모든 종목, 체결 때는 그 종목만 온다 → 받은 종목만 덮어쓴다
      'orderbook:update': (data) => {
        setGameState((prev) => ({
          ...prev,
          orderBooks: { ...prev.orderBooks, ...data.books },
        }))
      },

      'game:end': (data) => {
        setGameState((prev) => ({
          ...prev,
          result: data,
        }))
        setRejoinStatus('idle')
      },
    }

    if (isMock) {
      const emit = (event, data) => {
        handlers[event]?.(data)
      }

      const mock = startMockServer(emit, {
        mode: import.meta.env.VITE_MOCK_MODE === 'practice' ? 'practice' : 'battle',
      })
      mockRequestRef.current = mock.request

      return () => {
        mock.stop()
        mockRequestRef.current = null
      }
    }

    // 연결될 때마다(처음·새로고침·끊겼다 다시 연결) 저장된 정보가 있으면 같은 참가자로 돌아간다
    const rejoin = () => {
      const session = loadSession()
      if (!session) return
      setRejoinStatus('pending')
      socket.timeout(5000).emit('room:rejoin', session, (error, response) => {
        if (error || !response?.ok) {
          clearSession()
          setRejoinStatus('failed')
          return
        }
        setGameState((prev) => ({
          ...prev,
          room: { ...prev.room, roomId: response.roomId, mode: response.mode, status: response.status },
          playerId: response.playerId,
        }))
        // 게임 중이면 곧 game:resume이, 끝난 방이면 game:end가 온다
        if (response.status === 'waiting') setRejoinStatus('idle')
      })
    }

    const handleConnect = () => {
      setConnectionStatus('connected')
      rejoin()
    }

    const handleDisconnect = () => {
      setConnectionStatus('disconnected')
    }

    const handleConnectError = () => {
      setConnectionStatus('disconnected')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    connectSocket()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)

      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler)
      })

      disconnectSocket()
    }
  }, [isMock])

  const emitWithAck = (event, payload) =>
    new Promise((resolve) => {
      if (isMock && mockRequestRef.current) {
        resolve(mockRequestRef.current(event, payload))
        return
      }

      if (!socket.connected) {
        resolve({
          ok: false,
          code: 'SERVER_DISCONNECTED',
          message: '서버에 연결되어 있지 않습니다.',
        })
        return
      }

      socket.timeout(5000).emit(event, payload, (error, response) => {
        if (error) {
          resolve({
            ok: false,
            code: 'REQUEST_TIMEOUT',
            message: '서버 응답 시간이 초과되었습니다.',
          })
          return
        }

        resolve(response)
      })
    })

  const createRoom = async ({ nickname, mode }) => {
    const response = await emitWithAck('room:create', {
      nickname,
      mode,
    })

    if (!response?.ok || !response.roomId) {
      return response
    }

    if (response.token) {
      saveSession({ roomId: response.roomId, playerId: response.playerId, token: response.token })
    }

    setGameState((prev) => ({
      ...prev,
      ...resetGameData,
      room: {
        roomId: response.roomId,
        mode,
      },
      playerId: response.playerId,
    }))

    // 연습 모드는 방 생성 직후 게임 시작
    if (mode === 'practice') {
      const startResponse = await emitWithAck('room:start', {
        roomId: response.roomId,
      })

      if (!startResponse?.ok) {
        return {
          ...startResponse,
          roomCreated: true,
        }
      }
    }

    return response
  }

  const joinRoom = async ({ nickname, roomId }) => {
    const response = await emitWithAck('room:join', {
      roomId,
      nickname,
    })

    if (response?.ok && response.playerId) {
      if (response.token) {
        saveSession({ roomId, playerId: response.playerId, token: response.token })
      }
      setGameState((prev) => ({
        ...prev,
        room: {
          ...prev.room,
          roomId,
        },
        playerId: response.playerId,
      }))
    }

    return response
  }

  // 주문: 체결되면 내 체결 내역에 남긴다 (응답의 price는 평균 체결가)
  const placeOrder = async ({ stock, side, qty }) => {
    const response = await emitWithAck('order:place', {
      roomId: gameState.room?.roomId,
      stock,
      side,
      qty,
    })

    if (response?.ok) {
      setGameState((prev) => ({
        ...prev,
        myTrades: [
          { t: prev.elapsedTime, stock, side, qty: response.qty, price: response.price },
          ...prev.myTrades,
        ].slice(0, 30),
      }))
    }

    return response
  }

  // 시작 화면으로 돌아갈 때: 재접속 정보를 지운다
  const leaveGame = () => {
    clearSession()
    setRejoinStatus('idle')
    setGameState((prev) => ({ ...prev, ...resetGameData, room: null, playerId: null }))
  }

  return {
    connectionStatus,
    rejoinStatus,
    gameState,
    createRoom,
    joinRoom,
    placeOrder,
    leaveGame,
  }
}
