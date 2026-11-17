
import { useState } from 'react'
import './Home.css'

function Home() {
  const [nickname, setNickname] = useState('')
  const [roomId, setRoomId] = useState('')

  const isNicknameValid =
    nickname.trim().length >= 1 && nickname.trim().length <= 10

  const isRoomIdValid = /^\d{6}$/.test(roomId)

  const handleCreateRoom = () => {
    if (!isNicknameValid) return
    alert('방 만들기는 서버 연결 후 구현할 예정입니다.')
  }

  const handleJoinRoom = () => {
    if (!isNicknameValid || !isRoomIdValid) return
    alert('방 입장은 서버 연결 후 구현할 예정입니다.')
  }

  const handlePractice = () => {
    if (!isNicknameValid) return
    alert('연습 모드는 서버 연결 후 구현할 예정입니다.')
  }

  return (
    <main className="home">
      <section className="home-container">
        <header className="home-header">
          <p className="home-label">MOCK INVESTMENT BATTLE</p>
          <h1>모의투자 배틀</h1>
          <p className="home-description">
            가상의 투자 시장에서 다른 플레이어와 실력을 겨뤄보세요.
          </p>
        </header>

        <section className="home-form">
          <label htmlFor="nickname">닉네임</label>
          <input
            id="nickname"
            type="text"
            placeholder="닉네임을 입력하세요 (1~10자)"
            value={nickname}
            maxLength={10}
            onChange={(e) => setNickname(e.target.value)}
          />

          <div className="home-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!isNicknameValid}
              onClick={handleCreateRoom}
            >
              방 만들기
            </button>

            <div className="join-section">
              <label htmlFor="roomId">참가 PIN</label>
              <div className="join-input">
                <input
                  id="roomId"
                  type="text"
                  inputMode="numeric"
                  placeholder="6자리 PIN"
                  value={roomId}
                  maxLength={6}
                  onChange={(e) =>
                    setRoomId(e.target.value.replace(/\D/g, ''))
                  }
                />
                <button
                  type="button"
                  disabled={!isNicknameValid || !isRoomIdValid}
                  onClick={handleJoinRoom}
                >
                  입장
                </button>
              </div>
            </div>

            <button
              type="button"
              className="practice-button"
              disabled={!isNicknameValid}
              onClick={handlePractice}
            >
              혼자 연습하기
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}

export default Home
