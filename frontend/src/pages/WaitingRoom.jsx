import { useState } from 'react'
import './WaitingRoom.css'

const ERROR_MESSAGES = {
  NOT_HOST: '방장만 게임을 시작할 수 있습니다.',
  NOT_ENOUGH_PLAYERS: '게임을 시작하려면 참가자가 2명 이상이어야 합니다.',
  GAME_STARTED: '이미 게임이 시작되었습니다.',
  SERVER_DISCONNECTED: '서버 연결을 확인해 주세요.',
  REQUEST_TIMEOUT: '서버 응답 시간이 초과되었습니다.',
}

function WaitingRoom({ room, playerId, startRoom }) {
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)

  if (!room?.roomId) {
    return (
      <main className="waiting-page">
        <section className="waiting-card waiting-empty">
          <p className="waiting-eyebrow">ROOM LOBBY</p>
          <h1>대기실 정보를 불러오는 중이에요</h1>
          <p>잠시 후에도 PIN이 보이지 않으면 홈 화면에서 다시 입장해 주세요.</p>
        </section>
      </main>
    )
  }

  const players = room.players || []
  const isHost = room.hostId === playerId
  const canStart = isHost && players.length >= 2 && room.status === 'waiting'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.roomId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setErrorMessage('PIN 복사에 실패했습니다. 숫자를 직접 입력해 주세요.')
    }
  }

  const handleStart = async () => {
    if (!canStart || pending) return

    setPending(true)
    setErrorMessage('')

    try {
      const response = await startRoom({ roomId: room.roomId })

      if (!response?.ok) {
        setErrorMessage(
          ERROR_MESSAGES[response?.code] ||
            response?.message ||
            '게임 시작에 실패했습니다.',
        )
      }
    } catch {
      setErrorMessage('요청 중 오류가 발생했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="waiting-page">
      <section className="waiting-card">
        <header className="waiting-header">
          <p className="waiting-eyebrow">MOCK INVESTMENT BATTLE</p>
          <h1>대결 대기실</h1>
          <p>친구에게 PIN을 공유하고 함께 입장하세요.</p>
        </header>

        <section className="waiting-pin" aria-label="방 참가 PIN">
          <div>
            <p className="waiting-section-label">ROOM PIN</p>
            <strong>{room.roomId}</strong>
          </div>
          <button type="button" className="copy-button" onClick={handleCopy}>
            {copied ? '복사 완료' : 'PIN 복사'}
          </button>
        </section>

        <section className="waiting-roster" aria-labelledby="players-title">
          <div className="waiting-roster-heading">
            <div>
              <p className="waiting-section-label">PLAYERS</p>
              <h2 id="players-title">참가자</h2>
            </div>
            <span className="player-count">{players.length} / 8명</span>
          </div>

          {players.length > 0 ? (
            <ul className="player-list">
              {players.map((player) => (
                <li className="player-row" key={player.playerId}>
                  <span className="player-avatar" aria-hidden="true">
                    {player.nickname?.slice(0, 1) || '?'}
                  </span>
                  <span className="player-name">
                    {player.nickname}
                    {player.playerId === playerId && (
                      <span className="me-tag">나</span>
                    )}
                  </span>
                  {player.playerId === room.hostId && (
                    <span className="host-tag">방장</span>
                  )}
                  <span
                    className={`connection-dot ${
                      player.connected === false ? 'offline' : ''
                    }`}
                    aria-label={
                      player.connected === false ? '연결 끊김' : '연결됨'
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="waiting-empty-roster">참가자를 확인하고 있어요.</p>
          )}
        </section>

        <div className="waiting-footer">
          <p>
            {players.length < 2
              ? '한 명이 더 입장하면 시작할 수 있어요.'
              : '모두 준비되면 게임을 시작하세요.'}
          </p>

          {isHost ? (
            <button
              type="button"
              className="start-button"
              disabled={!canStart || pending}
              onClick={handleStart}
            >
              {pending ? '게임 준비 중...' : '게임 시작'}
            </button>
          ) : (
            <div className="host-waiting" role="status">
              방장이 게임을 시작할 때까지 기다려 주세요.
            </div>
          )}

          {errorMessage && (
            <p className="waiting-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default WaitingRoom