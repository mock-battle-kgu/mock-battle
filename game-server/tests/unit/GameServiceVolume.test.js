// v0.3 캔들 거래량: 시장 거래량(market.tick volumes) + 참가자 체결 수량
const { GameService } = require('../../src/game/GameService');
const { RoomManager } = require('../../src/game/RoomManager');

function setup() {
  const sent = [];
  const io = { to: (room) => ({ emit: (event, data) => sent.push({ room, event, data }) }) };
  const market = { publishControl: () => {}, publishFlow: () => {} };
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ nickname: '방장', mode: 'battle', socketId: 's1' });
  rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });
  const games = new GameService({
    io, market, rooms,
    durationSec: 30, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020'], backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: () => {}, random: () => 0,
  });
  games.startGame(room);
  // index.js처럼 거래량을 먼저 넣고 시세를 처리한다
  const tick = (t, prices, volumes) => {
    games.handleVolumes({ roomId: room.roomId, t, prices, volumes });
    games.handleTick({ roomId: room.roomId, t, prices, volumes });
  };
  const candles = () => sent.filter((s) => s.event === 'candle:close').map((s) => s.data);
  return { games, room, tick, candles };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('캔들 v = 5초 동안의 시장 거래량 합', () => {
  const { tick, candles } = setup();
  for (let t = 1; t <= 5; t += 1) tick(t, { GANA: 46_000 }, { GANA: 200 });
  expect(candles()[0].candles.GANA).toEqual({ o: 46_000, h: 46_000, l: 46_000, c: 46_000, v: 1000 });
});

test('참가자 체결 수량이 다음 틱 캔들의 거래량에 더해진다', () => {
  const { games, room, tick, candles } = setup();
  tick(1, { GANA: 46_000 }, { GANA: 200 });
  games.placeOrder({ roomId: room.roomId, playerId: 'p1', stock: 'GANA', side: 'buy', qty: 50 });
  games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 30 });
  for (let t = 2; t <= 5; t += 1) tick(t, { GANA: 46_000 }, { GANA: 200 });
  expect(candles()[0].candles.GANA.v).toBe(1000 + 80);
});

test('volumes가 없는 시세(예전 시세 엔진, fake-market)는 v가 0', () => {
  const { tick, candles } = setup();
  for (let t = 1; t <= 5; t += 1) tick(t, { GANA: 46_000 });
  expect(candles()[0].candles.GANA.v).toBe(0);
});
