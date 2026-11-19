const { Portfolio } = require('../../src/game/Portfolio');
const { GameError } = require('../../src/game/errors');

const expectCode = (fn, code) => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    expect(err.code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

test('매수하면 현금이 줄고 보유 주식이 생긴다', () => {
  const p = new Portfolio(10_000_000);
  expect(p.buy('GANA', 100, 46_000)).toEqual({ price: 46_000, qty: 100, cash: 5_400_000 });
  expect(p.holdings.get('GANA')).toEqual({ qty: 100, avgPrice: 46_000 });
});

test('추가 매수하면 평균단가를 다시 계산한다 (원 단위 반올림)', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 100, 46_000);
  p.buy('GANA', 50, 47_010);
  // (100×46000 + 50×47010) ÷ 150 = 46336.67 → 46337
  expect(p.holdings.get('GANA')).toEqual({ qty: 150, avgPrice: 46_337 });
});

test('매도하면 현금이 늘고 평균단가는 그대로', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 100, 46_000);
  expect(p.sell('GANA', 40, 50_000)).toEqual({ price: 50_000, qty: 40, cash: 7_400_000 });
  expect(p.holdings.get('GANA')).toEqual({ qty: 60, avgPrice: 46_000 });
});

test('전부 팔면 보유 목록에서 사라진다', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 10, 46_000);
  p.sell('GANA', 10, 46_000);
  expect(p.holdings.has('GANA')).toBe(false);
  expect(p.cash).toBe(10_000_000);
});

test('현금이 모자라면 NOT_ENOUGH_CASH, 잔고는 그대로', () => {
  const p = new Portfolio(10_000_000);
  expectCode(() => p.buy('GANA', 1000, 46_000), 'NOT_ENOUGH_CASH');
  expect(p.cash).toBe(10_000_000);
  expect(p.holdings.size).toBe(0);
});

test('가진 것보다 많이 팔면 NOT_ENOUGH_SHARES', () => {
  const p = new Portfolio(10_000_000);
  expectCode(() => p.sell('GANA', 1, 46_000), 'NOT_ENOUGH_SHARES');
  p.buy('GANA', 5, 46_000);
  expectCode(() => p.sell('GANA', 6, 46_000), 'NOT_ENOUGH_SHARES');
});

test.each([0, -1, 1.5, '3', null, undefined])('수량 %p 는 INVALID_QTY', (qty) => {
  const p = new Portfolio(10_000_000);
  expectCode(() => p.buy('GANA', qty, 46_000), 'INVALID_QTY');
});

test('총자산과 수익률은 현재가로 계산한다', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 100, 46_000); // 현금 5,400,000
  const prices = { GANA: 50_000 }; // 평가액 5,000,000
  expect(p.totalAsset(prices)).toBe(10_400_000);
  expect(p.returnPct(prices)).toBe(4);
  expect(p.snapshot(prices)).toEqual({
    cash: 5_400_000,
    holdings: { GANA: { qty: 100, avgPrice: 46_000 } },
    totalAsset: 10_400_000,
    returnPct: 4,
  });
});

test('수익률은 소수점 1자리로 반올림', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 3, 10_000);
  expect(p.returnPct({ GANA: 13_333 })).toBe(0.1); // +9,999원 → 0.09999% → 0.1
});
