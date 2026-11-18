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

describe('캔들', () => {
  const tick = (games, room, t, price) => games.handleTick({ roomId: room.roomId, t, prices: { GANA: price } });

  test('5초마다 candle:close를 보낸다', () => {
    const { games, room, events } = setup({ durationSec: 20 });
    games.startGame(room);
    [0, 1, 2, 3, 4].forEach((t) => tick(games, room, t, 100 + t));
    expect(events('candle:close')).toHaveLength(0);
    tick(games, room, 5, 90);
    expect(events('candle:close')[0]).toEqual({
      room: room.roomId, event: 'candle:close', data: { t: 5, candles: { GANA: { o: 101, h: 104, l: 90, c: 90 } } },
    });
    [6, 7, 8, 9, 10].forEach((t) => tick(games, room, t, 100));
    expect(events('candle:close')).toHaveLength(2);
    expect(games.get(room.roomId).candles).toHaveLength(2);
  });

  test('5의 배수가 아닌 시점에 끝나면 남은 캔들을 game:end 전에 보낸다', () => {
    const { games, room, sent, events } = setup({ durationSec: 7 });
    games.startGame(room);
    for (let t = 0; t <= 7; t += 1) tick(games, room, t, 100 + t);
    const closes = events('candle:close').map((e) => e.data);
    expect(closes).toEqual([
      { t: 5, candles: { GANA: { o: 101, h: 105, l: 101, c: 105 } } },
      { t: 7, candles: { GANA: { o: 106, h: 107, l: 106, c: 107 } } },
    ]);
    const order = sent.map((s) => s.event);
    expect(order.lastIndexOf('candle:close')).toBeLessThan(order.indexOf('game:end'));
  });
});

describe('주문', () => {
  const order = (games, room, playerId, stock, side, qty) =>
    games.placeOrder({ roomId: room.roomId, playerId, stock, side, qty });
  const codeOf = (fn) => {
    try {
      fn();
    } catch (err) {
      return err.code;
    }
    return 'NO_ERROR';
  };

  test('서버가 가진 최신 시세로 체결된다', () => {
    const { games, room } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 0, prices: { GANA: 46_000 } });
    games.handleTick({ roomId: room.roomId, t: 1, prices: { GANA: 46_500 } });
    expect(order(games, room, 'p1', 'GANA', 'buy', 10)).toEqual({ price: 46_500, qty: 10, cash: 9_535_000 });
    expect(games.get(room.roomId).orders).toEqual([
      { t: 1, playerId: 'p1', stock: 'GANA', side: 'buy', qty: 10, price: 46_500 },
    ]);
  });

  test('참가자마다 계좌가 따로다', () => {
    const { games, room } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 0, prices: { GANA: 46_000 } });
    order(games, room, 'p1', 'GANA', 'buy', 100);
    expect(codeOf(() => order(games, room, 'p2', 'GANA', 'sell', 1))).toBe('NOT_ENOUGH_SHARES');
  });

  test('게임 전·종료 후·참가자가 아니면 GAME_NOT_PLAYING', () => {
    const { games, room } = setup({ durationSec: 5 });
    expect(codeOf(() => order(games, room, 'p1', 'GANA', 'buy', 1))).toBe('GAME_NOT_PLAYING');
    games.startGame(room);
    expect(codeOf(() => order(games, room, 'p1', 'GANA', 'buy', 1))).toBe('GAME_NOT_PLAYING'); // 시세 도착 전
    games.handleTick({ roomId: room.roomId, t: 0, prices: { GANA: 46_000 } });
    expect(codeOf(() => order(games, room, 'p9', 'GANA', 'buy', 1))).toBe('GAME_NOT_PLAYING');
    games.handleTick({ roomId: room.roomId, t: 5, prices: { GANA: 46_000 } });
    expect(codeOf(() => order(games, room, 'p1', 'GANA', 'buy', 1))).toBe('GAME_NOT_PLAYING');
  });

  test('없는 종목, 잘못된 side는 거부', () => {
    const { games, room } = setup();
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 0, prices: { GANA: 46_000 } });
    expect(codeOf(() => order(games, room, 'p1', 'ZZZZ', 'buy', 1))).toBe('INVALID_STOCK');
    expect(codeOf(() => order(games, room, 'p1', 'GANA', 'hold', 1))).toBe('INVALID_SIDE');
  });

  test('연습 모드는 STOCK_A만 거래한다', () => {
    const { games, room } = setup({ mode: 'practice' });
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 0, prices: { STOCK_A: 10_000 } });
    expect(order(games, room, 'p1', 'STOCK_A', 'buy', 5).cash).toBe(9_950_000);
    expect(codeOf(() => order(games, room, 'p1', 'GANA', 'buy', 1))).toBe('INVALID_STOCK');
  });
});

describe('계좌·순위 알림', () => {
  const tick = (games, room, t, price) => games.handleTick({ roomId: room.roomId, t, prices: { GANA: price } });

  test('1초마다 각자에게 portfolio:update, 방 전체에 rank:update', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    tick(games, room, 0, 10_000);
    const portfolios = events('portfolio:update');
    expect(portfolios.map((e) => e.room).sort()).toEqual(['s1', 's2']); // 소켓별로 따로
    expect(portfolios[0].data).toEqual({ cash: 10_000_000, holdings: {}, totalAsset: 10_000_000, returnPct: 0 });
    expect(events('rank:update')[0]).toEqual({
      room: room.roomId, event: 'rank:update',
      data: { t: 0, ranks: [
        { rank: 1, playerId: 'p1', nickname: '방장', returnPct: 0 },
        { rank: 2, playerId: 'p2', nickname: '손님', returnPct: 0 },
      ] },
    });
  });

  test('체결되면 그 사람에게만 바로 portfolio:update', () => {
    const { games, room, sent } = setup();
    games.startGame(room);
    tick(games, room, 0, 10_000);
    sent.length = 0;
    games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 100 });
    expect(sent).toEqual([{
      room: 's2', event: 'portfolio:update',
      data: { cash: 9_000_000, holdings: { GANA: { qty: 100, avgPrice: 10_000 } }, totalAsset: 10_000_000, returnPct: 0 },
    }]);
  });

  test('주가가 오르면 산 사람이 1위로 올라간다', () => {
    const { games, room, events } = setup();
    games.startGame(room);
    tick(games, room, 0, 10_000);
    games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 100 });
    tick(games, room, 1, 12_000);
    const { ranks } = events('rank:update').at(-1).data;
    expect(ranks.map((r) => [r.playerId, r.returnPct])).toEqual([['p2', 2], ['p1', 0]]);
  });

  test('연결이 끊긴 사람에게는 portfolio:update를 보내지 않지만 순위에는 남는다', () => {
    const { games, room, rooms, events } = setup();
    games.startGame(room);
    rooms.leave('s2');
    tick(games, room, 0, 10_000);
    expect(events('portfolio:update').map((e) => e.room)).toEqual(['s1']);
    expect(events('rank:update')[0].data.ranks).toHaveLength(2);
  });

  test('연습 모드는 rank:update를 보내지 않는다', () => {
    const { games, room, events } = setup({ mode: 'practice' });
    games.startGame(room);
    games.handleTick({ roomId: room.roomId, t: 0, prices: { STOCK_A: 10_000 } });
    expect(events('rank:update')).toHaveLength(0);
    expect(events('portfolio:update')).toHaveLength(1);
  });

  test('game:end에 최종 순위와 총자산이 담긴다', () => {
    const { games, room, events } = setup({ durationSec: 2 });
    games.startGame(room);
    tick(games, room, 0, 10_000);
    games.placeOrder({ roomId: room.roomId, playerId: 'p2', stock: 'GANA', side: 'buy', qty: 100 });
    tick(games, room, 1, 10_000);
    tick(games, room, 2, 15_000);
    expect(events('game:end')[0].data).toEqual({
      ranks: [
        { rank: 1, playerId: 'p2', nickname: '손님', returnPct: 5, totalAsset: 10_500_000 },
        { rank: 2, playerId: 'p1', nickname: '방장', returnPct: 0, totalAsset: 10_000_000 },
      ],
      rumors: [],
      reveal: null,
    });
  });
});
