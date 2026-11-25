// v0.3 재접속: game:resume으로 지금 게임 상태를 한 번에 보낸다
const { GameService } = require('../../src/game/GameService');
const { RoomManager } = require('../../src/game/RoomManager');

function setup({ mode = 'battle', durationSec = 30 } = {}) {
  const sent = [];
  const io = { to: (target) => ({ emit: (event, data) => sent.push({ target, event, data }) }) };
  const market = { publishControl: () => {}, publishFlow: () => {} };
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ nickname: '방장', mode, socketId: 's1' });
  if (mode === 'battle') rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });
  const games = new GameService({
    io, market, rooms,
    durationSec, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020'], backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: () => {}, random: () => 0,
  });
  games.startGame(room);
  const tick = (t, prices) => games.handleTick({ roomId: room.roomId, t, prices });
  const to = (target, event) => sent.filter((s) => s.target === target && s.event === event);
  return { games, room, tick, to };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('재접속한 소켓에만 지금 시각·시세·캔들·내 잔고를 보낸다', () => {
  const { games, room, tick, to } = setup();
  for (let t = 0; t <= 6; t += 1) tick(t, { GANA: 46_000 + t * 10 });
  games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 10 });

  expect(games.resume({ roomId: room.roomId, playerId: 'p2', socketId: 's2-new' })).toBe(true);
  const [{ data }] = to('s2-new', 'game:resume');
  expect(data).toMatchObject({
    mode: 'battle', durationSec: 30, startCash: 10_000_000, rumorCards: 2, t: 6,
    prices: { GANA: 46_060 },
  });
  expect(data.stocks).toHaveLength(6);
  expect(data.candles).toHaveLength(1); // t=1~5 캔들 하나
  expect(data.portfolio.holdings).toEqual({ GANA: { qty: 10, avgPrice: 46_060 } });
  expect(data.stockInfo).toBeNull();
  expect(data.books).toEqual({});
  expect(to(room.roomId, 'game:resume')).toHaveLength(0); // 방 전체에는 보내지 않음
});

test('연습 모드는 STOCK_A 하나, 루머 카드 0장', () => {
  const { games, room, tick, to } = setup({ mode: 'practice' });
  tick(0, { STOCK_A: 10_000 });
  games.resume({ roomId: room.roomId, playerId: 'p1', socketId: 'new' });
  expect(to('new', 'game:resume')[0].data).toMatchObject({
    mode: 'practice', rumorCards: 0, stocks: [{ code: 'STOCK_A', name: '???' }],
  });
});

test('끝난 게임에 돌아오면 game:end를 다시 보낸다', () => {
  const { games, room, tick, to } = setup({ durationSec: 2 });
  tick(0, { GANA: 46_000 });
  tick(2, { GANA: 46_000 });
  games.resume({ roomId: room.roomId, playerId: 'p1', socketId: 'new' });
  expect(to('new', 'game:end')).toHaveLength(1);
  expect(to('new', 'game:end')[0].data.ranks).toHaveLength(2);
  expect(to('new', 'game:resume')).toHaveLength(0);
});

test('게임이 없으면 false', () => {
  const { games } = setup();
  expect(games.resume({ roomId: '000000', playerId: 'p1', socketId: 'x' })).toBe(false);
});
