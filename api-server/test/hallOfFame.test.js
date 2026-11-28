const request = require('supertest');

jest.mock('../src/db', () => ({
  pool: {
    execute: jest.fn()
  }
}));

const app = require('../src/app');
const { pool } = require('../src/db');

describe('GET /api/hall-of-fame', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('기본 조회 시 HTTP 200과 명예의 전당 기록을 반환한다', async () => {
    const rows = [
      {
        nickname: 'player1',
        returnPct: '31.8',
        playedAt: '2026-11-20 14:05:00'
      },
      {
        nickname: 'player2',
        returnPct: '12.5',
        playedAt: '2026-11-20 14:06:00'
      }
    ];

    pool.execute.mockResolvedValueOnce([rows]);

    const response = await request(app).get('/api/hall-of-fame');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        nickname: 'player1',
        returnPct: 31.8,
        playedAt: '2026-11-20 14:05:00'
      },
      {
        nickname: 'player2',
        returnPct: 12.5,
        playedAt: '2026-11-20 14:06:00'
      }
    ]);

    const [sql, params] = pool.execute.mock.calls[0];

    expect(sql).toMatch(/WHERE\s+g\.mode\s*=\s*'battle'/i);
    expect(sql).toMatch(
      /ORDER\s+BY\s+p\.return_pct\s+DESC\s*,\s*g\.played_at\s+ASC/i
    );
    expect(sql).toMatch(/LIMIT\s+\?/i);
    expect(params).toEqual([10]);
  });

  test('limit=3이면 조회 개수를 3으로 지정한다', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get('/api/hall-of-fame?limit=3');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(pool.execute.mock.calls[0][1]).toEqual([3]);
  });

  test.each(['0', '51', 'abc', '1.5'])(
    '잘못된 limit=%s 입력 시 HTTP 400을 반환한다',
    async (limit) => {
      const response = await request(app)
        .get('/api/hall-of-fame')
        .query({ limit });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FIELD');
      expect(pool.execute).not.toHaveBeenCalled();
    }
  );

  test('DB 연결 실패 시 HTTP 503을 반환한다', async () => {
    const dbError = new Error('Database unavailable');
    dbError.code = 'ECONNREFUSED';

    pool.execute.mockRejectedValueOnce(dbError);

    const response = await request(app)
      .get('/api/hall-of-fame');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'DB_UNAVAILABLE',
      message: 'Database unavailable'
    });
  });
});
