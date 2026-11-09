const { CandleBuilder } = require('../../src/game/CandleBuilder');

test('틱 5개로 시가·고가·저가·종가를 만든다', () => {
  const b = new CandleBuilder(5);
  const prices = [100, 120, 90, 110, 105];
  const results = prices.map((p, i) => b.add(i + 1, { GANA: p }));
  expect(results.slice(0, 4)).toEqual([null, null, null, null]);
  expect(results[4]).toEqual({ t: 5, candles: { GANA: { o: 100, h: 120, l: 90, c: 105 } } });
});

test('t=0 시작가는 캔들에 넣지 않는다', () => {
  const b = new CandleBuilder(5);
  expect(b.add(0, { GANA: 999 })).toBeNull();
  [1, 2, 3, 4].forEach((t) => b.add(t, { GANA: 100 }));
  expect(b.add(5, { GANA: 100 }).candles.GANA).toEqual({ o: 100, h: 100, l: 100, c: 100 });
});

test('여러 종목을 한 번에 묶는다', () => {
  const b = new CandleBuilder(5);
  let closed;
  for (let t = 1; t <= 5; t += 1) closed = b.add(t, { GANA: 100 + t, DARA: 50 - t });
  expect(closed.candles).toEqual({
    GANA: { o: 101, h: 105, l: 101, c: 105 },
    DARA: { o: 49, h: 49, l: 45, c: 45 },
  });
});

test('다음 캔들은 새로 시작한다', () => {
  const b = new CandleBuilder(5);
  for (let t = 1; t <= 5; t += 1) b.add(t, { GANA: 100 });
  let closed;
  for (let t = 6; t <= 10; t += 1) closed = b.add(t, { GANA: 200 + t });
  expect(closed).toEqual({ t: 10, candles: { GANA: { o: 206, h: 210, l: 206, c: 210 } } });
});

test('틱이 빠져도 5의 배수에서 닫는다', () => {
  const b = new CandleBuilder(5);
  b.add(3, { GANA: 100 });
  expect(b.add(5, { GANA: 90 })).toEqual({ t: 5, candles: { GANA: { o: 100, h: 100, l: 90, c: 90 } } });
});

test('flush는 모인 틱으로 닫고, 없으면 null', () => {
  const b = new CandleBuilder(5);
  expect(b.flush(0)).toBeNull();
  b.add(6, { GANA: 100 });
  b.add(7, { GANA: 105 });
  expect(b.flush(7)).toEqual({ t: 7, candles: { GANA: { o: 100, h: 105, l: 100, c: 105 } } });
  expect(b.flush(7)).toBeNull();
});
