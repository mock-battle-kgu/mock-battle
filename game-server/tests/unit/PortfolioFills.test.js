const { Portfolio } = require('../../src/game/Portfolio');

test('여러 호가 체결을 한 번에 반영하고 평균 체결가를 돌려준다', () => {
  const p = new Portfolio(10_000_000);
  const result = p.applyFills('GANA', 'buy', [{ price: 46_050, qty: 65 }, { price: 46_100, qty: 97 }]);
  expect(result).toEqual({ price: 46_080, qty: 162, cash: 10_000_000 - (46_050 * 65 + 46_100 * 97) });
  expect(p.holdings.get('GANA')).toEqual({ qty: 162, avgPrice: 46_080 });
});

test('현금이 모자라면 아무것도 바꾸지 않고 NOT_ENOUGH_CASH', () => {
  const p = new Portfolio(1_000_000);
  expect(() => p.applyFills('GANA', 'buy', [{ price: 46_050, qty: 10 }, { price: 46_100, qty: 20 }]))
    .toThrow(expect.objectContaining({ code: 'NOT_ENOUGH_CASH' }));
  expect(p.cash).toBe(1_000_000);
  expect(p.holdings.size).toBe(0);
});

test('매도도 여러 호가를 합쳐 현금에 더한다', () => {
  const p = new Portfolio(10_000_000);
  p.buy('GANA', 100, 46_000);
  const result = p.applyFills('GANA', 'sell', [{ price: 45_950, qty: 60 }, { price: 45_900, qty: 40 }]);
  expect(result.qty).toBe(100);
  expect(result.price).toBe(45_930);
  expect(p.holdings.has('GANA')).toBe(false);
});
