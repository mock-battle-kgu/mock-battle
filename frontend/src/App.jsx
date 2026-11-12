import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import WaitingRoom from './pages/WaitingRoom'
import Game from './pages/Game'
import Result from './pages/Result'
import HallOfFame from './pages/HallOfFame'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
        <Route path="/hall-of-fame" element={<HallOfFame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App