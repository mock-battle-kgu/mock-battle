const { GameService } = require('../../src/game/GameService');
const { RoomManager } = require('../../src/game/RoomManager');

function setup({ mode = 'battle', durationSec = 10, random = () => 0 } = {}) {
  const sent = []; // 화면으로 보낸 것
  const controls = []; // 시세 엔진으로 보낸 것
  const roomUpdates = [];
  const io = { to: (room) => ({ emit: (event, data) => sent.push({ room, event, data }) }) };
  const market = { publishControl: (msg) => controls.push(msg) };
  const rooms = new RoomManager();

  const { room } = rooms.createRoom({ nickname: '방장', mode, socketId: 's1' });
  if (mode === 'battle') rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });

  const games = new GameService({
    io, market, rooms,
    durationSec, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020', 'chip-2024'],
    backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: (r) => roomUpdates.push(RoomManager.publicState(r)),
    random,
  });
  const events = (name) => sent.filter((s) => s.event === name);
  return { games, room, rooms, sent, controls, roomUpdates, events };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('게임 시작', () => {
  test('대결 모드: 시세 엔진에 6개 종목으로 시작 신호를 보낸다', () => {
    const { games, room, controls } = setup();
    games.startGame(room);
    expect(controls).toEqual([{
      type: 'start', roomId: room.roomId, mode: 'battle', durationSec: 10,
      stocks: ['GANA', 'DARA', 'MABA', 'SAAH', 'JACHA', 'KATA'],
    }]);
  });

  test('연습 모드: 시나리오 하나를 골라 보낸다', () => {
    const { games, room, controls } = setup({ mode: 'practice', random: () => 0.9 });
    games.startGame(room);
    expect(controls[0]).toEqual({
      type: 'start', roomId: room.roomId, mode: 'practice', durationSec: 10, scenarioId: 'chip-2024',
    });
  });

  test('참가자들에게 game:start를 보낸다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    const [start] = events('game:start');
    expect(start.room).toBe(room.roomId);
    expect(start.data).toMatchObject({ mode: 'battle', durationSec: 10, startCash: 10_000_000, rumorCards: 2 });
    expect(start.data.stocks).toHaveLength(6);
    expect(start.data.stocks[0]).toEqual({ code: 'GANA', name: '가나전자' });
  });

  test('연습 모드는 루머 카드가 0장이고 종목 이름이 숨겨진다', () => {
    const { games, room, events } = setup({ mode: 'practice' });
    games.startGame(room);
    expect(events('game:start')[0].data).toMatchObject({ rumorCards: 0, stocks: [{ code: 'STOCK_A', name: '???' }] });
  });
});

describe('시세 전달', () => {
  test('해당 방에 price:tick으로 t와 prices만 보낸다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 1, prices: { GANA: 46000 }, impactPct: { GANA: 0.5 } });
    expect(events('price:tick')).toEqual([{ room: room.roomId, event: 'price:tick', data: { t: 1, prices: { GANA: 46000 } } }]);
    expect(games.get(room.roomId).prices).toEqual({ GANA: 46000 });
  });

  test('시작하지 않은 방의 시세는 무시한다', () => {
    const { games, events } = setup();
    games.handleTick({ roomId: '999999', t: 1, prices: { GANA: 1 } });
    expect(events('price:tick')).toHaveLength(0);
  });
});

describe('게임 종료', () => {
  test('t가 시간에 도달하면 끝나고, 시세 엔진에 stop을 보낸다', () => {
    const { games, room, rooms, controls, roomUpdates, events } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 10, prices: { GANA: 47000 } });

    expect(events('game:end')).toHaveLength(1);
    expect(rooms.get(room.roomId).status).toBe('ended');
    expect(roomUpdates.at(-1).status).toBe('ended');
    expect(controls.at(-1)).toEqual({ type: 'stop', roomId: room.roomId });
  });

  test('끝난 뒤 들어온 시세는 보내지 않고, 두 번 끝나지 않는다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 10, prices: { GANA: 1 } });
    games.handleTick({ roomId: room.roomId, t: 11, prices: { GANA: 2 } });
    games.endGame(room.roomId, 'again');
    expect(events('price:tick')).toHaveLength(1);
    expect(events('game:end')).toHaveLength(1);
  });

  test('시세가 끊겨도 시간 + 5초 뒤 백업 타이머로 끝난다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    jest.advanceTimersByTime(14_999);
    expect(events('game:end')).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(events('game:end')).toHaveLength(1);
  });

  test('정상 종료하면 백업 타이머는 취소된다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 10, prices: { GANA: 1 } });
    jest.advanceTimersByTime(20_000);
    expect(events('game:end')).toHaveLength(1);
  });

  test('끝나고 30초 뒤 방과 게임이 지워진다', () => {
    const { games, room, rooms } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 10, prices: { GANA: 1 } });
    jest.advanceTimersByTime(29_999);
    expect(rooms.get(room.roomId)).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(rooms.get(room.roomId)).toBeNull();
    expect(games.get(room.roomId)).toBeNull();
  });
});
