const request = require('supertest');

jest.mock('../src/db', () => ({
  pool: {
    execute: jest.fn()
  }
}));

const app = require('../src/app');
const { pool } = require('../src/db');

describe('GET /api/stocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('정상 조회 시 200과 코드순 6종목을 반환한다', async () => {
    const stocks = [
      { code: 'DARA', name: '다라항공', sector: '항공', description: '국제선 비중이 높은 대형 항공사, 유가에 민감' },
      { code: 'GANA', name: '가나전자', sector: '반도체', description: '메모리 반도체를 만드는 국내 대표 전자 기업' },
      { code: 'JACHA', name: '자차푸드', sector: '식품', description: '경기를 덜 타는 안정적인 식품 회사' },
      { code: 'KATA', name: '카타에너지', sector: '에너지', description: '정유·발전 사업을 하는 에너지 기업' },
      { code: 'MABA', name: '마바게임즈', sector: '게임', description: '모바일 게임 흥행에 따라 실적이 크게 바뀜' },
      { code: 'SAAH', name: '사아바이오', sector: '바이오', description: '신약 임상 결과에 주가가 크게 움직이는 바이오 기업' }
    ];

    pool.execute.mockResolvedValueOnce([stocks]);

    const response = await request(app).get('/api/stocks');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ stocks });
    expect(response.body.stocks).toHaveLength(6);

    expect(response.body.stocks.map(stock => stock.code)).toEqual([
      'DARA', 'GANA', 'JACHA', 'KATA', 'MABA', 'SAAH'
    ]);

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute.mock.calls[0][0])
      .toMatch(/ORDER\s+BY\s+code\b/i);
  });

  test('DB 연결 실패 시 503과 DB_UNAVAILABLE을 반환한다', async () => {
    const dbError = new Error('Database connection failed');
    dbError.code = 'ECONNREFUSED';

    pool.execute.mockRejectedValueOnce(dbError);

    const response = await request(app).get('/api/stocks');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'DB_UNAVAILABLE',
      message: 'Database unavailable'
    });
  });
});