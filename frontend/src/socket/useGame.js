import { useEffect, useState } from 'react'
import { socket, connectSocket, disconnectSocket } from './socket'
import { startMockServer } from '../mock/mockServer'

const INITIAL_STATE = {
  room: null,
  game: null,
  prices: {},
  candles: {},
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
      'room:update': (data) =>
        setGameState((prev) => ({ ...prev, room: data })),

      'game:start': (data) =>
        setGameState((prev) => ({ ...prev, game: data })),

      'price:tick': (data) =>
        setGameState((prev) => ({ ...prev, prices: data.prices })),

      'candle:close': (data) =>
        setGameState((prev) => ({ ...prev, candles: data.candles })),

      'portfolio:update': (data) =>
        setGameState((prev) => ({ ...prev, portfolio: data })),

      'rank:update': (data) =>
        setGameState((prev) => ({ ...prev, ranks: data.ranks })),

      'news:push': (data) =>
        setGameState((prev) => ({
          ...prev,
          news: [...prev.news, data],
        })),

      'market:flow': (data) =>
        setGameState((prev) => ({ ...prev, marketFlow: data })),

      'game:end': (data) =>
        setGameState((prev) => ({ ...prev, result: data })),
    }

    if (isMock) {
      const emit = (event, data) => {
        console.log(`[Mock] ${event}`, data)
        handlers[event]?.(data)
    }

      const stopMockServer = startMockServer(emit)

      return () => stopMockServer()
    }

    const handleConnect = () => setConnectionStatus('connected')
    const handleDisconnect = () => setConnectionStatus('disconnected')
    const handleConnectError = () => setConnectionStatus('disconnected')

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

  return {
    connectionStatus,
    gameState,
  }
}
