const { FlowTracker } = require('../../src/game/FlowTracker');

test('roll: 지난 1초의 순매수량(매수 − 매도)을 돌려주고 비운다', () => {
  const flow = new FlowTracker();
  flow.record('GANA', 'buy', 100);
  flow.record('GANA', 'sell', 30);
  flow.record('DARA', 'sell', 50);
  expect(flow.roll()).toEqual({ GANA: 70, DARA: -50 });
  expect(flow.roll()).toEqual({});
});

test('buyRatio: 최근 10초의 매수 비율, 거래 없는 종목은 빠진다', () => {
  const flow = new FlowTracker(10);
  flow.record('GANA', 'buy', 60);
  flow.roll();
  flow.record('GANA', 'sell', 40);
  flow.record('DARA', 'buy', 10);
  flow.roll();
  expect(flow.buyRatio()).toEqual({ GANA: 0.6, DARA: 1 });
});

test('10초가 지나면 오래된 체결은 비율에서 빠진다', () => {
  const flow = new FlowTracker(10);
  flow.record('GANA', 'buy', 100);
  flow.roll();
  for (let i = 0; i < 9; i += 1) flow.roll();
  expect(flow.buyRatio()).toEqual({ GANA: 1 }); // 아직 10초 안
  flow.roll();
  expect(flow.buyRatio()).toEqual({}); // 11초째에는 사라짐
});
