import { changeClass, formatChangePct, formatTime, formatWon } from '../../utils/format'

const STATUS_TEXT = {
  connected: '연결됨',
  mock: 'Mock 서버',
  reconnecting: '다시 연결하는 중',
  disconnected: '연결 끊김',
}

function GameHeader({ isBattle, roomId, playerCount, remainingTime, totalAsset, returnPct, connectionStatus, progress }) {
  return (
    <header className="gm-card gm-header">
      <div className="gm-header-left">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect x="4" y="12" width="5" height="10" rx="1" fill="#3182F6" />
          <rect x="11.5" y="7" width="5" height="13" rx="1" fill="#F04452" />
          <rect x="19" y="3" width="5" height="15" rx="1" fill="#F04452" />
        </svg>
        <span className="gm-logo">모의투자 배틀</span>
        <span className={`gm-mode-badge ${isBattle ? 'battle' : 'practice'}`}>{isBattle ? '대결 모드' : '연습 모드'}</span>
        <span className="gm-muted">
          {isBattle
            ? `방 PIN ${roomId ? `${roomId.slice(0, 3)} ${roomId.slice(3)}` : '—'} · ${playerCount}명`
            : '혼자 하는 블라인드 모드 · 종목명과 날짜는 숨김'}
        </span>
        <span className={`gm-conn ${connectionStatus}`}>
          <span className="gm-conn-dot" aria-hidden="true" />
          {STATUS_TEXT[connectionStatus] ?? connectionStatus}
        </span>
      </div>

      <div className="gm-header-mid">
        <span className="gm-muted">남은 시간</span>
        <span className={`gm-timer ${remainingTime <= 60 ? 'urgent' : ''}`}>{formatTime(remainingTime)}</span>
        {progress && <span className="gm-muted gm-small">{progress}</span>}
      </div>

      <div className="gm-header-right">
        <span className="gm-muted">내 총자산</span>
        <span className="gm-asset">
          {formatWon(totalAsset)} <span className={changeClass(returnPct)}>{formatChangePct(returnPct)}</span>
        </span>
      </div>
    </header>
  )
}

export default GameHeader
