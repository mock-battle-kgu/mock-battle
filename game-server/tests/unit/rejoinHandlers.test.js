// 새로고침 시나리오: 소켓을 끊고 새 소켓으로 room:rejoin
const { io: connectClient } = require('socket.io-client');
const { createApp } = require('../../src/app');
const { RoomManager } = require('../../src/game/RoomManager');
const { registerRoomHandlers } = require('../../src/socket/roomHandlers');
const { registerGameHandlers } = require('../../src/socket/gameHandlers');
const { registerRejoinHandlers } = require('../../src/socket/rejoinHandlers');
const { GameService } = require('../../src/game/GameService');

let server;
let io;
let url;
let games;
const clients = [];

beforeEach(async () => {
  ({ server, io } = createApp());
  const rooms = new RoomManager();
  games = new GameService({
    io, rooms, market: { publishControl: () => {}, publishFlow: () => {} },
    durationSec: 600, startCash: 10_000_000, rumorCards: 2,
    scenarioIds: ['covid-2020'], backupGraceSec: 5, endedRoomTtlMs: 30_000,
    broadcastRoom: () => {},
  });
  registerRoomHandlers({ io, rooms, onGameStart: (room) => games.startGame(room) });
  registerGameHandlers({ io, games });
  registerRejoinHandlers({ io, rooms, games });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  for (const game of games.games.values()) clearTimeout(game.backupTimer);
  await new Promise((resolve) => io.close(resolve));
});

async function connect() {
  const client = connectClient(url, { transports: ['websocket'], reconnection: false });
  clients.push(client);
  await new Promise((resolve) => client.on('connect', resolve));
  return client;
}

const request = (client, event, payload) => new Promise((resolve) => client.emit(event, payload, resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startedBattle() {
  const host = await connect();
  const { roomId } = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  const guest = await connect();
  const { token } = await request(guest, 'room:join', { roomId, nickname: '손님' });
  await request(host, 'room:start', { roomId });
  games.handleTick({ roomId, t: 0, prices: { GANA: 46_000 } });
  return { host, guest, roomId, token };
}

test('게임 중 새로고침해도 같은 참가자로 돌아와 주문하고 잔고를 이어 간다', async () => {
  const { guest, roomId, token } = await startedBattle();
  const before = await request(guest, 'order:place', { stock: 'GANA', side: 'buy', qty: 10 });
  expect(before.ok).toBe(true);

  guest.close(); // 새로고침
  await wait(50);

  const again = await connect();
  const resume = new Promise((resolve) => again.once('game:resume', resolve));
  const res = await request(again, 'room:rejoin', { roomId, playerId: 'p2', token });
  expect(res).toEqual({ ok: true, roomId, playerId: 'p2', mode: 'battle', status: 'playing' });

  const state = await resume;
  expect(state.portfolio.holdings).toEqual({ GANA: { qty: 10, avgPrice: 46_000 } });

  const after = await request(again, 'order:place', { stock: 'GANA', side: 'sell', qty: 10 });
  expect(after).toMatchObject({ ok: true, qty: 10 });
});

test('token이 틀리면 REJOIN_FAILED이고 주문할 수 없다', async () => {
  const { roomId } = await startedBattle();
  const stranger = await connect();
  const res = await request(stranger, 'room:rejoin', { roomId, playerId: 'p2', token: 'wrong' });
  expect(res).toEqual({ ok: false, code: 'REJOIN_FAILED', message: expect.any(String) });
  const order = await request(stranger, 'order:place', { stock: 'GANA', side: 'buy', qty: 1 });
  expect(order.code).toBe('GAME_NOT_PLAYING');
});
