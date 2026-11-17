import { useEffect, useState } from 'react'
import { socket } from './socket'

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

export function useGame() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [gameState, setGameState] = useState(INITIAL_STATE)

  useEffect(() => {
    const handleConnect = () => setConnectionStatus('connected')
    const handleDisconnect = () => setConnectionStatus('disconnected')

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
        setGameState((prev) => ({ ...prev, news: [...prev.news, data] })),
      'market:flow': (data) =>
        setGameState((prev) => ({ ...prev, marketFlow: data })),
      'game:end': (data) =>
        setGameState((prev) => ({ ...prev, result: data })),
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)

      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler)
      })

      socket.disconnect()
    }
  }, [])

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
