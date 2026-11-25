// v0.3 호가창 체결과 종목 지표 (protocol.md order:place, orderbook:update, stock:info)
const { GameService } = require('../../src/game/GameService');
const { RoomManager } = require('../../src/game/RoomManager');
const { OrderBook } = require('../../src/game/OrderBook');

function setup({ mode = 'battle', bookOptions = {} } = {}) {
  const sent = [];
  const io = { to: (room) => ({ emit: (event, data) => sent.push({ room, event, data }) }) };
  const market = { publishControl: () => {}, publishFlow: () => {} };
  const rooms = new RoomManager();

  const { room } = rooms.createRoom({ nickname: '방장', mode, socketId: 's1' });
  if (mode === 'battle') rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });

  const games = new GameService({
    io, market, rooms,
    durationSec: 10, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020'], backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: () => {}, random: () => 0,
    createOrderBook: () => new OrderBook(bookOptions),
  });
  games.startGame(room);
  const events = (name) => sent.filter((s) => s.event === name);
  const order = (playerId, stock, side, qty) => games.placeOrder({ roomId: room.roomId, playerId, stock, side, qty });
  const tick = (t, prices, extra = {}) => games.handleTick({ roomId: room.roomId, t, prices, ...extra });
  return { games, room, events, order, tick };
}

const codeOf = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return 'NO_ERROR';
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('틱마다 모든 종목의 호가창을 방 전체에 보낸다', () => {
  const { room, events, tick } = setup();
  tick(1, { GANA: 46_000, DARA: 19_000 });
  const [update] = events('orderbook:update');
  expect(update.room).toBe(room.roomId);
  expect(update.data.t).toBe(1);
  expect(Object.keys(update.data.books)).toEqual(['GANA', 'DARA']);
  expect(update.data.books.GANA.asks[0]).toEqual({ price: 46_050, qty: 65 });
});

test('매수는 매도호가로 체결되고 응답에 평균 체결가·fills가 담긴다', () => {
  const { order, tick } = setup();
  tick(1, { GANA: 46_000 });
  expect(order('p1', 'GANA', 'buy', 100)).toEqual({
    price: 46_068,
    qty: 100,
    requestedQty: 100,
    cash: 10_000_000 - (46_050 * 65 + 46_100 * 35),
    fills: [{ price: 46_050, qty: 65 }, { price: 46_100, qty: 35 }],
  });
});

test('먼저 산 사람이 싼 호가를 가져가서, 나중 사람의 평균 체결가가 더 높다', () => {
  const { order, tick } = setup();
  tick(1, { GANA: 46_000 });
  const first = order('p1', 'GANA', 'buy', 100);
  const second = order('p2', 'GANA', 'buy', 100);
  expect(second.price).toBeGreaterThan(first.price);
});

test('체결되면 그 종목 호가창만 바로 다시 보낸다', () => {
  const { events, order, tick } = setup();
  tick(1, { GANA: 46_000, DARA: 19_000 });
  order('p1', 'GANA', 'buy', 10);
  const last = events('orderbook:update').at(-1).data;
  expect(Object.keys(last.books)).toEqual(['GANA']);
  expect(last.books.GANA.asks[0].qty).toBe(55);
});

test('잔량이 모자라면 일부만 체결, 다 쓰면 NO_LIQUIDITY, 다음 틱에 다시 채워진다', () => {
  const { games, room, order, tick } = setup({ bookOptions: { baseDepthWon: 300_000 } }); // 잔량을 줄여서 확인
  tick(1, { KATA: 15_000 });
  const total = games.get(room.roomId).books.KATA.snapshot().asks.reduce((s, l) => s + l.qty, 0);
  const result = order('p1', 'KATA', 'buy', total + 50);
  expect(result.qty).toBe(total);
  expect(result.requestedQty).toBe(total + 50);
  expect(codeOf(() => order('p2', 'KATA', 'buy', 1))).toBe('NO_LIQUIDITY');
  tick(2, { KATA: 15_000 });
  expect(codeOf(() => order('p2', 'KATA', 'buy', 1))).toBe('NO_ERROR');
});

test('현금이 모자라 거부되면 호가 잔량은 그대로다', () => {
  const { games, room, order, tick } = setup();
  tick(1, { SAAH: 54_000 });
  expect(codeOf(() => order('p1', 'SAAH', 'buy', 300))).toBe('NOT_ENOUGH_CASH');
  expect(games.get(room.roomId).books.SAAH.snapshot().asks[0].qty).toBe(55);
});

test('체결 기록에는 실제 체결 수량과 평균 체결가가 남는다', () => {
  const { games, room, order, tick } = setup();
  tick(1, { GANA: 46_000 });
  order('p1', 'GANA', 'buy', 100);
  expect(games.get(room.roomId).orders).toEqual([
    { t: 1, playerId: 'p1', stock: 'GANA', side: 'buy', qty: 100, price: 46_068 },
  ]);
});

test('연습 모드도 호가창으로 체결된다', () => {
  const { order, tick } = setup({ mode: 'practice' });
  tick(1, { STOCK_A: 10_000 });
  expect(order('p1', 'STOCK_A', 'buy', 10).price).toBe(10_010);
});

test('stock:info: t=0 종목 지표를 저장하고 방 전체에 보낸다', () => {
  const { games, room, events } = setup();
  const fundamentals = { GANA: { sector: '반도체', eps: 4120, bps: 30000, sectorPer: 13 } };
  games.handleStockInfo({ roomId: room.roomId, t: 0, fundamentals });
  expect(events('stock:info')).toEqual([{ room: room.roomId, event: 'stock:info', data: { stocks: fundamentals } }]);
  expect(games.get(room.roomId).fundamentals).toEqual(fundamentals);
});

test('stock:info: 지표가 없거나 모르는 방이면 보내지 않는다', () => {
  const { games, room, events } = setup();
  games.handleStockInfo({ roomId: room.roomId, t: 0 });
  games.handleStockInfo({ roomId: '999999', t: 0, fundamentals: { GANA: {} } });
  expect(events('stock:info')).toEqual([]);
});
