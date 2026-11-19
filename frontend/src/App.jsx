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
    gameState,
    createRoom,
    joinRoom,
  } = useGame()

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (gameState.result) {
      navigate('/result', { replace: true })
    }
  }, [gameState.result, navigate])

  const statusText = {
    mock: 'Mock 서버 연결',
    connected: '서버 연결됨',
    disconnected: '서버 연결 끊김',
  }

  // 게임 화면에서는 가리고, 연결이 끊기면 어느 화면에서든 표시
  const showStatus =
    location.pathname !== '/game' || connectionStatus === 'disconnected'

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
          element={<Game gameState={gameState} />}
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
