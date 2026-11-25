// 플레이어 시장 영향: market.flow(시세 엔진)·market:flow(화면) 전송
const { GameService } = require('../../src/game/GameService');
const { RoomManager } = require('../../src/game/RoomManager');

function setup({ mode = 'battle' } = {}) {
  const sent = [];
  const flows = []; // 시세 엔진으로 보낸 순매수량
  const io = { to: (room) => ({ emit: (event, data) => sent.push({ room, event, data }) }) };
  const market = { publishControl: () => {}, publishFlow: (msg) => flows.push(msg) };
  const rooms = new RoomManager();

  const { room } = rooms.createRoom({ nickname: '방장', mode, socketId: 's1' });
  if (mode === 'battle') rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });

  const games = new GameService({
    io, market, rooms,
    durationSec: 10, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020'], backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: () => {}, random: () => 0,
  });
  const events = (name) => sent.filter((s) => s.event === name);
  return { games, room, flows, events };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('대결 모드: 틱마다 지난 1초 순매수량을 시세 엔진에 보낸다', () => {
  const { games, room, flows } = setup();
  games.startGame(room);
  games.handleTick({ roomId: room.roomId, t: 1, prices: { GANA: 46000 } });
  games.placeOrder({ roomId: room.roomId, playerId: 'p1', stock: 'GANA', side: 'buy', qty: 30 });
  games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 20 });
  games.handleTick({ roomId: room.roomId, t: 2, prices: { GANA: 46100 } });

  expect(flows).toEqual([
    { roomId: room.roomId, t: 1, netQty: {} },
    { roomId: room.roomId, t: 2, netQty: { GANA: 50 } },
  ]);
});

test('대결 모드: 화면에 market:flow로 매수 비율과 시세 엔진의 impactPct를 보낸다', () => {
  const { games, room, events } = setup();
  games.startGame(room);
  games.handleTick({ roomId: room.roomId, t: 1, prices: { GANA: 46000 } });
  games.placeOrder({ roomId: room.roomId, playerId: 'p1', stock: 'GANA', side: 'buy', qty: 30 });
  games.placeOrder({ roomId: room.roomId, playerId: 'p1', stock: 'GANA', side: 'sell', qty: 10 });
  games.handleTick({ roomId: room.roomId, t: 2, prices: { GANA: 46100 }, impactPct: { GANA: 0.4 } });

  expect(events('market:flow').at(-1)).toEqual({
    room: room.roomId,
    event: 'market:flow',
    data: { t: 2, windowSec: 10, buyRatio: { GANA: 0.75 }, impactPct: { GANA: 0.4 } },
  });
});

test('연습 모드는 순매수량도 market:flow도 보내지 않는다', () => {
  const { games, room, flows, events } = setup({ mode: 'practice' });
  games.startGame(room);
  games.handleTick({ roomId: room.roomId, t: 1, prices: { STOCK_A: 10000 } });
  expect(flows).toEqual([]);
  expect(events('market:flow')).toEqual([]);
});
