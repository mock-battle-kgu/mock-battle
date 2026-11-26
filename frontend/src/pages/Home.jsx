import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Home.css'

const BATTLE_AVAILABLE = true

function Home({ createRoom, joinRoom }) {
  const navigate = useNavigate()

  const [nickname, setNickname] = useState('')
  const [roomId, setRoomId] = useState('')
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const trimmedNickname = nickname.trim()
  const isNicknameValid =
    trimmedNickname.length >= 1 && trimmedNickname.length <= 10
  const isRoomIdValid = /^\d{6}$/.test(roomId)

  const getErrorMessage = (response) => {
    const messages = {
      ROOM_NOT_FOUND: '존재하지 않는 방입니다.',
      ROOM_FULL: '방 정원이 가득 찼습니다.',
      GAME_STARTED: '이미 게임이 시작된 방입니다.',
      NICKNAME_TAKEN: '이미 사용 중인 닉네임입니다.',
      SERVER_DISCONNECTED: '서버 연결을 확인해 주세요.',
      REQUEST_TIMEOUT: '서버 응답 시간이 초과되었습니다.',
    }

    return messages[response?.code] || response?.message || '요청에 실패했습니다.'
  }

  const handleRequest = async (request, destination) => {
    if (!isNicknameValid || pending) return

    setPending(true)
    setErrorMessage('')

    try {
      const response = await request()

      if (!response?.ok) {
        setErrorMessage(getErrorMessage(response))
        return
      }

      navigate(destination)
    } catch {
      setErrorMessage('요청 중 오류가 발생했습니다.')
    } finally {
      setPending(false)
    }
  }

  const handleCreateRoom = () => {
    if (!BATTLE_AVAILABLE) return
    handleRequest(
      () => createRoom({ nickname: trimmedNickname, mode: 'battle' }),
      '/waiting',
    )
  }

  const handleJoinRoom = () => {
    if (!BATTLE_AVAILABLE || !isRoomIdValid) return

    handleRequest(
      () => joinRoom({ nickname: trimmedNickname, roomId }),
      '/waiting',
    )
  }

  const handlePractice = () => {
    handleRequest(
      () => createRoom({ nickname: trimmedNickname, mode: 'practice' }),
      '/game',
    )
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
            onChange={(event) => setNickname(event.target.value)}
            disabled={pending}
          />

          <div className="home-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!BATTLE_AVAILABLE || !isNicknameValid || pending}
              onClick={handleCreateRoom}
            >
              {pending ? '처리 중...' : '방 만들기'}
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
                  disabled={!BATTLE_AVAILABLE || pending}
                  onChange={(event) =>
                    setRoomId(event.target.value.replace(/\D/g, ''))
                  }
                />
                <button
                  type="button"
                  disabled={
                    !BATTLE_AVAILABLE || !isNicknameValid || !isRoomIdValid || pending
                  }
                  onClick={handleJoinRoom}
                >
                  입장
                </button>
              </div>
            </div>

            {!BATTLE_AVAILABLE && (
              <p className="home-notice">
                대결 모드는 준비 중이에요. 지금은 혼자 연습하기만 할 수 있어요.
              </p>
            )}

            <button
              type="button"
              className="practice-button"
              disabled={!isNicknameValid || pending}
              onClick={handlePractice}
            >
              혼자 연습하기
            </button>
          </div>

          {errorMessage && (
            <p className="home-error" role="alert">
              {errorMessage}
            </p>
          )}
        </section>
      </section>
    </main>
  )
}

export default Home