import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ConnectionStatus from './components/ConnectionStatus';
import { initMockServer } from './mock/mockServer';
import Home from './pages/Home';

function WaitingRoom() { return <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold'}}>대기실 화면</div>; }
function Game() { return <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold'}}>게임 화면</div>; }
function Result() { return <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold'}}>결과 화면</div>; }
function HallOfFame() { return <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold'}}>명예의 전당 화면</div>; }

export default function App() {
  useEffect(() => {
    const cleanup = initMockServer();
    return cleanup;
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
        <Route path="/hof" element={<HallOfFame />} />
      </Routes>
      <ConnectionStatus />
    </>
  );
}
