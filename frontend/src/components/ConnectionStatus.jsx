import React, { useState, useEffect } from 'react';
import { socket } from '../socket/socket';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (!isConnected) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        backgroundColor: '#dc3545', color: '#fff', textAlign: 'center', padding: '10px',
        fontWeight: 'bold', zIndex: 9999
      }}>
        연결이 끊겼습니다
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '10px', right: '10px',
      backgroundColor: '#28a745', color: '#fff', padding: '6px 12px',
      borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      🟢 연결됨
    </div>
  );
}
