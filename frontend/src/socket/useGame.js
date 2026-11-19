import { useEffect, useState } from 'react'
import { socket, connectSocket, disconnectSocket } from './socket'
import { startMockServer } from '../mock/mockServer'

const INITIAL_STATE = {
  room: null,
  game: null,
  prices: {},
  basePrices: {}, // 종목별 시작가 (등락률 기준)
  candles: {},
  candleTime: null,
  portfolio: null,
  ranks: [],
  news: [],
  marketFlow: null,
  result: null,
}

export const useGame = () => {
  const isMock = import.meta.env.VITE_MOCK === 'true'

  const [connectionStatus, setConnectionStatus] = useState(
    isMock ? 'mock' : 'disconnected',
  )

  const [gameState, setGameState] = useState(INITIAL_STATE)

  useEffect(() => {
    const handlers = {
      'room:update': (data) => {
        setGameState((prev) => ({
          ...prev,
          room: data,
        }))
      },

      'game:start': (data) => {
        setGameState((prev) => ({
          ...prev,
          game: data,
        }))
      },

      'price:tick': (data) => {
        setGameState((prev) => ({
          ...prev,
          prices: data.prices,
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
          candles: data.candles,
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

      'game:end': (data) => {
        setGameState((prev) => ({
          ...prev,
          result: data,
        }))
      },
    }

    if (isMock) {
      const emit = (event, data) => {
        console.log(`[Mock] ${event}`, data)
        handlers[event]?.(data)
      }

      const stopMockServer = startMockServer(emit)

      return () => {
        stopMockServer()
      }
    }

    const handleConnect = () => {
      setConnectionStatus('connected')
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

  const createRoom = ({ nickname, mode }) =>
    emitWithAck('room:create', { nickname, mode })

  const joinRoom = ({ nickname, roomId }) =>
    emitWithAck('room:join', { nickname, roomId })

  return {
    connectionStatus,
    gameState,
    createRoom,
    joinRoom,
  }
}
