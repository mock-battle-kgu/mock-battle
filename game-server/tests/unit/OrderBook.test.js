const { OrderBook, tickSize } = require('../../src/game/OrderBook');

const codeOf = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return 'NO_ERROR';
};

test('호가 단위: 2만 원 미만 10원, 5만 원 미만 50원, 그 이상 100원', () => {
  expect(tickSize(15_000)).toBe(10);
  expect(tickSize(46_000)).toBe(50);
  expect(tickSize(54_000)).toBe(100);
});

test('refresh: 현재가 위로 매도 5호가, 아래로 매수 5호가, 멀수록 잔량이 많다', () => {
  const book = new OrderBook();
  book.refresh(46_000);
  const { asks, bids } = book.snapshot();
  expect(asks.map((l) => l.price)).toEqual([46_050, 46_100, 46_150, 46_200, 46_250]);
  expect(bids.map((l) => l.price)).toEqual([45_950, 45_900, 45_850, 45_800, 45_750]);
  expect(asks[0].qty).toBe(65); // 300만 원 ÷ 46,050원
  expect(asks[1].qty).toBeGreaterThan(asks[0].qty);
});

test('quote: 매수는 매도 1호가부터 차례로, 잔량은 건드리지 않는다', () => {
  const book = new OrderBook();
  book.refresh(46_000);
  const { fills, filledQty } = book.quote('buy', 217);
  expect(fills).toEqual([
    { price: 46_050, qty: 65 },
    { price: 46_100, qty: 97 },
    { price: 46_150, qty: 55 },
  ]);
  expect(filledQty).toBe(217);
  expect(book.snapshot().asks[0].qty).toBe(65);
});

test('commit 뒤에는 잔량이 줄어 다음 사람은 더 비싸게 산다', () => {
  const book = new OrderBook();
  book.refresh(46_000);
  book.commit('buy', book.quote('buy', 65).fills);
  expect(book.quote('buy', 1).fills).toEqual([{ price: 46_100, qty: 1 }]);
});

test('매도는 매수 1호가부터 체결된다', () => {
  const book = new OrderBook();
  book.refresh(46_000);
  expect(book.quote('sell', 10).fills).toEqual([{ price: 45_950, qty: 10 }]);
});

test('잔량이 모자라면 있는 만큼만, 하나도 없으면 NO_LIQUIDITY', () => {
  const book = new OrderBook();
  book.refresh(46_000);
  const all = book.snapshot().asks.reduce((sum, l) => sum + l.qty, 0);
  const { fills, filledQty } = book.quote('buy', all + 100);
  expect(filledQty).toBe(all);
  book.commit('buy', fills);
  expect(codeOf(() => book.quote('buy', 1))).toBe('NO_LIQUIDITY');
  book.refresh(46_000); // 1초 뒤 다시 채워짐
  expect(codeOf(() => book.quote('buy', 1))).toBe('NO_ERROR');
});
