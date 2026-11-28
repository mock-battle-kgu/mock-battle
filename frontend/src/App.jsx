import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useEffect } from 'react'

import Home from './pages/Home'
import WaitingRoom from './pages/WaitingRoom'
import Game from './pages/Game'
import Result from './pages/Result'
import HallOfFame from './pages/HallOfFame'

import { useGame } from './socket/useGame'
import './App.css'

function AppContent() {
  const {
    connectionStatus,
    rejoinStatus,
    gameState,
    createRoom,
    joinRoom,
    placeOrder,
    leaveGame,
  } = useGame()

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (gameState.result) {
      navigate('/result', { replace: true })
    }
  }, [gameState.result, navigate])

  // 게임이 시작되거나(대기실) 새로고침 뒤 다시 붙으면 게임 화면으로
  const hasGame = Boolean(gameState.game)
  useEffect(() => {
    if (hasGame && !gameState.result && ['/', '/waiting'].includes(location.pathname)) {
      navigate('/game', { replace: true })
    }
  }, [hasGame, gameState.result, location.pathname, navigate])

  const statusText = {
    mock: 'Mock 서버 연결',
    connected: '서버 연결됨',
    disconnected: '서버 연결 끊김',
  }

  // 게임 화면은 상단 바에 연결 상태가 있으므로 가린다
  const showStatus = location.pathname !== '/game'

  return (
    <div>
      {showStatus && (
        <div className={`connection-status ${connectionStatus}`}>
          {statusText[connectionStatus]}
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Home
              createRoom={createRoom}
              joinRoom={joinRoom}
            />
          }
        />

        <Route
          path="/waiting"
          element={<WaitingRoom />}
        />

        <Route
          path="/game"
          element={
            <Game
              gameState={gameState}
              connectionStatus={connectionStatus}
              rejoinStatus={rejoinStatus}
              placeOrder={placeOrder}
              leaveGame={leaveGame}
            />
          }
        />

        <Route
          path="/result"
          element={
            <Result
              result={gameState.result}
              playerId={gameState.playerId}
              mode={
                gameState.game?.mode ||
                gameState.room?.mode
              }
              onHome={leaveGame}
            />
          }
        />

        <Route
          path="/hall-of-fame"
          element={<HallOfFame />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
