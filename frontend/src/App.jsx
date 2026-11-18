
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import WaitingRoom from './pages/WaitingRoom'
import Game from './pages/Game'
import Result from './pages/Result'
import HallOfFame from './pages/HallOfFame'
import { useGame } from './socket/useGame'
import './App.css'

function AppContent() {
  const { connectionStatus, gameState, createRoom, joinRoom } = useGame()
  const location = useLocation()

  const statusText = {
    mock: 'Mock 서버 연결',
    connected: '서버 연결됨',
    disconnected: '서버 연결 끊김',
  }

  return (
    <div>
      {location.pathname !== '/game' && (
        <div className={`connection-status ${connectionStatus}`}>
          {statusText[connectionStatus]}
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={<Home createRoom={createRoom} joinRoom={joinRoom} />}
        />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<Game gameState={gameState} />} />
        <Route path="/result" element={<Result />} />
        <Route path="/hall-of-fame" element={<HallOfFame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
