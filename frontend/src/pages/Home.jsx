import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket/socket';

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 오류 코드를 한글 문장으로 변환 (가이드 4-1 공통 규칙)
  const translateError = (code) => {
    const errorMap = {
      NOT_ENOUGH_CASH: '현금이 부족합니다',
      ROOM_NOT_FOUND: '방을 찾을 수 없습니다',
      INVALID_PIN: 'PIN 번호는 6자리 숫자여야 합니다',
      NICKNAME_REQUIRED: '닉네임을 1~10자 사이로 입력해주세요',
      // 필요에 따른 추가 오류 매핑
    };
    return errorMap[code] || code || '알 수 없는 오류가 발생했습니다.';
  };

  const validateNickname = () => {
    if (!nickname || nickname.length > 10) {
      setErrorMsg(translateError('NICKNAME_REQUIRED'));
      return false;
    }
    return true;
  };

  // 방 만들기 요청
  const handleCreateRoom = () => {
    if (!validateNickname()) return;
    setErrorMsg('');
    socket.emit('room:create', { nickname }, (res) => {
      if (res && res.error) {
        setErrorMsg(translateError(res.error));
      } else if (res && res.roomId) {
        navigate(`/waiting?pin=${res.roomId}`);
      } else {
        // 목 모드 또는 임시 이동
        navigate('/waiting?pin=482913');
      }
    });
  };

  // PIN 입장 요청
  const handleJoinRoom = () => {
    if (!validateNickname()) return;
    if (pin.length !== 6) {
      setErrorMsg(translateError('INVALID_PIN'));
      return;
    }
    setErrorMsg('');
    socket.emit('room:join', { roomId: pin, nickname }, (res) => {
      if (res && res.error) {
        setErrorMsg(translateError(res.error));
      } else {
        navigate(`/waiting?pin=${pin}`);
      }
    });
  };

  // 혼자 연습 모드 (대기실을 건너뛰고 바로 게임 화면으로 이동)
  const handlePractice = () => {
    if (!validateNickname()) return;
    setErrorMsg('');
    navigate('/game?mode=practice');
  };

  return (
    <div style={{
      maxWidth: '400px', margin: '60px auto', padding: '30px',
      background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>모의투자 배틀</h2>

      {errorMsg && (
        <div style={{
          backgroundColor: '#f8d7da', color: '#721c24', padding: '10px',
          borderRadius: '4px', marginBottom: '15px', fontSize: '14px', fontWeight: 'bold'
        }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginBottom: '20px', textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
          닉네임 (1~10자)
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={10}
          placeholder="닉네임을 입력하세요"
          style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>

      <div style={{ marginBottom: '25px', textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
          PIN 번호 (입장 시에만 필요)
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          maxLength={6}
          placeholder="숫자 6자리 입력"
          style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', letterSpacing: '2px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleCreateRoom}
          style={{ padding: '12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          방 만들기
        </button>
        <button
          onClick={handleJoinRoom}
          style={{ padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          PIN으로 입장
        </button>
        <button
          onClick={handlePractice}
          style={{ padding: '12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          혼자 연습 모드
        </button>
      </div>
    </div>
  );
}
