// 게임 결과를 API 서버에 저장한다 (docs/protocol.md 4장 POST /api/results)
// 저장이 실패해도 게임 진행에는 영향이 없도록, 오류를 던지지 않고 로그만 남긴다.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ResultClient {
  constructor({ apiUrl, logger, fetchFn = fetch, retries = 3, retryDelayMs = 2000 } = {}) {
    this.url = `${apiUrl}/api/results`;
    this.logger = logger;
    this.fetchFn = fetchFn;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  // 성공하면 gameId, 끝내 실패하면 null
  async save(result) {
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        const res = await this.fetchFn(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        });
        if (res.ok) {
          const { gameId } = await res.json();
          this.logger?.info({ roomId: result.roomId, gameId, attempt }, 'game result saved');
          return gameId;
        }
        // 400대는 요청이 잘못된 것이라 다시 보내도 같으므로 바로 포기
        if (res.status < 500) {
          this.logger?.error({ roomId: result.roomId, status: res.status }, 'game result rejected');
          return null;
        }
        this.logger?.warn({ roomId: result.roomId, status: res.status, attempt }, 'game result save failed');
      } catch (err) {
        this.logger?.warn({ roomId: result.roomId, err: err.message, attempt }, 'game result save failed');
      }
      if (attempt < this.retries) await sleep(this.retryDelayMs);
    }
    this.logger?.error({ roomId: result.roomId }, 'game result was not saved');
    return null;
  }
}

module.exports = { ResultClient };
