const { io: connectClient } = require('socket.io-client');
const { createApp } = require('../../src/app');
const { RoomManager } = require('../../src/game/RoomManager');
const { GameService } = require('../../src/game/GameService');
const { registerRoomHandlers, broadcastRoom } = require('../../src/socket/roomHandlers');
const { registerGameHandlers } = require('../../src/socket/gameHandlers');

let server;
let io;
let url;
let games;
const clients = [];

beforeEach(async () => {
  ({ server, io } = createApp());
  const rooms = new RoomManager();
  games = new GameService({
    io, rooms, market: { publishControl: () => {} },
    durationSec: 600, startCash: 10_000_000, rumorCards: 2, scenarioIds: ['covid-2020'],
    backupGraceSec: 5, endedRoomTtlMs: 30_000, broadcastRoom: (r) => broadcastRoom(io, r),
  });
  registerRoomHandlers({ io, rooms, onGameStart: (r) => games.startGame(r) });
  registerGameHandlers({ io, games });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  for (const g of games.games.values()) clearTimeout(g.backupTimer);
  await new Promise((resolve) => io.close(resolve));
});

async function connect() {
  const client = connectClient(url, { transports: ['websocket'] });
  clients.push(client);
  await new Promise((resolve) => client.on('connect', resolve));
  return client;
}
const request = (client, event, payload) => new Promise((resolve) => client.emit(event, payload, resolve));

async function startedRoom() {
  const host = await connect();
  const { roomId } = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  const guest = await connect();
  await request(guest, 'room:join', { roomId, nickname: '손님' });
  await request(host, 'room:start', { roomId });
  games.handleTick({ roomId, t: 0, prices: { GANA: 46_000 } });
  return { host, guest, roomId };
}

test('order:place로 매수하면 체결 결과가 온다', async () => {
  const { host } = await startedRoom();
  const res = await request(host, 'order:place', { stock: 'GANA', side: 'buy', qty: 10 });
  expect(res).toEqual({ ok: true, price: 46_000, qty: 10, cash: 9_540_000 });
});

test('실패하면 ok:false와 코드가 온다', async () => {
  const { host } = await startedRoom();
  const res = await request(host, 'order:place', { stock: 'GANA', side: 'buy', qty: 1000 });
  expect(res).toEqual({ ok: false, code: 'NOT_ENOUGH_CASH', message: expect.any(String) });
});

test('요청에 다른 사람 playerId를 넣어도 내 계좌로만 처리된다', async () => {
  const { host, guest, roomId } = await startedRoom();
  await request(host, 'order:place', { stock: 'GANA', side: 'buy', qty: 10 });
  const res = await request(guest, 'order:place', { roomId, playerId: 'p1', stock: 'GANA', side: 'sell', qty: 10 });
  expect(res.code).toBe('NOT_ENOUGH_SHARES');
});

test('방에 들어가지 않은 소켓의 주문은 거부된다', async () => {
  await startedRoom();
  const stranger = await connect();
  const res = await request(stranger, 'order:place', { stock: 'GANA', side: 'buy', qty: 1 });
  expect(res.code).toBe('GAME_NOT_PLAYING');
});
