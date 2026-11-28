const { ResultClient } = require('../../src/api/resultClient');

const result = {
  roomId: '482913', mode: 'battle', playedAt: '2026-11-23T05:00:00.000Z', durationSec: 600,
  players: [{ nickname: '단타의신', rank: 1, returnPct: 31.8, totalAsset: 13180000, rumorsUsed: 0 }],
};

// 응답을 차례로 돌려주는 가짜 fetch (Error를 넣으면 네트워크 오류)
function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next.status < 300, status: next.status, json: async () => next.body };
  };
  return { fn, calls };
}

const client = (fetchFn, retries = 3) => new ResultClient({ apiUrl: 'http://api-server:3000', fetchFn, retries, retryDelayMs: 0 });

test('결과를 POST /api/results로 보내고 gameId를 돌려준다', async () => {
  const { fn, calls } = fakeFetch({ status: 201, body: { gameId: 42 } });
  await expect(client(fn).save(result)).resolves.toBe(42);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe('http://api-server:3000/api/results');
  expect(calls[0].options.method).toBe('POST');
  expect(JSON.parse(calls[0].options.body)).toEqual(result);
});

test('서버 오류(503)나 네트워크 오류면 다시 보낸다', async () => {
  const { fn, calls } = fakeFetch({ status: 503 }, new Error('ECONNREFUSED'), { status: 201, body: { gameId: 7 } });
  await expect(client(fn).save(result)).resolves.toBe(7);
  expect(calls).toHaveLength(3);
});

test('3번 모두 실패하면 오류를 던지지 않고 null', async () => {
  const { fn, calls } = fakeFetch({ status: 500 }, { status: 500 }, { status: 500 }, { status: 201, body: { gameId: 1 } });
  await expect(client(fn).save(result)).resolves.toBeNull();
  expect(calls).toHaveLength(3);
});

test('400대 응답은 다시 보내도 같으므로 바로 포기한다', async () => {
  const { fn, calls } = fakeFetch({ status: 400, body: { code: 'INVALID_FIELD' } });
  await expect(client(fn).save(result)).resolves.toBeNull();
  expect(calls).toHaveLength(1);
});
