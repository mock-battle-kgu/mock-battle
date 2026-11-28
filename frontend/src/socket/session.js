// 재접속용 정보 저장 (새로고침해도 남고, 탭을 닫으면 사라지는 sessionStorage)
const KEY = 'mock-battle-session'

export const saveSession = (session) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // 저장소를 못 쓰는 환경이면 재접속만 안 될 뿐 게임은 계속된다
  }
}

export const loadSession = () => {
  try {
    const session = JSON.parse(sessionStorage.getItem(KEY))
    return session?.roomId && session?.playerId && session?.token ? session : null
  } catch {
    return null
  }
}

export const clearSession = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
