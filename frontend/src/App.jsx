import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import WaitingRoom from './pages/WaitingRoom'
import Game from './pages/Game'
import Result from './pages/Result'
import HallOfFame from './pages/HallOfFame'
import { useGame } from './socket/useGame'
import './App.css'

function App() {
  const { connectionStatus } = useGame()

  const statusText = {
    mock: 'Mock 서버 연결',
    connected: '서버 연결됨',
    disconnected: '서버 연결 끊김',
  }

  return (
    <BrowserRouter>
      <div>
        <div className="connection-status">
          {statusText[connectionStatus]}
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/waiting" element={<WaitingRoom />} />
          <Route path="/game" element={<Game />} />
          <Route path="/result" element={<Result />} />
          <Route path="/hall-of-fame" element={<HallOfFame />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App