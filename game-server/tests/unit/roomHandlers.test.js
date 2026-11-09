const { io: connectClient } = require('socket.io-client');
const { createApp } = require('../../src/app');
const { RoomManager } = require('../../src/game/RoomManager');
const { registerRoomHandlers } = require('../../src/socket/roomHandlers');

let server;
let io;
let url;
let started;
const clients = [];

beforeEach(async () => {
  ({ server, io } = createApp());
  started = [];
  registerRoomHandlers({ io, rooms: new RoomManager(), onGameStart: (room) => started.push(room.roomId) });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await new Promise((resolve) => io.close(resolve));
});

async function connect() {
  const client = connectClient(url, { transports: ['websocket'] });
  clients.push(client);
  await new Promise((resolve) => client.on('connect', resolve));
  return client;
}

const request = (client, event, payload) =>
  new Promise((resolve) => client.emit(event, payload, resolve));

const nextUpdate = (client) => new Promise((resolve) => client.once('room:update', resolve));

test('방을 만들면 PIN과 p1을 받고 room:update가 온다', async () => {
  const host = await connect();
  const update = nextUpdate(host);
  const res = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  expect(res).toEqual({ ok: true, roomId: expect.stringMatching(/^\d{6}$/), playerId: 'p1' });
  expect((await update).players).toEqual([{ playerId: 'p1', nickname: '방장', connected: true }]);
});

test('입장하면 방 전체가 새 참가자 목록을 받는다', async () => {
  const host = await connect();
  const { roomId } = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  const guest = await connect();
  const hostUpdate = nextUpdate(host);
  const res = await request(guest, 'room:join', { roomId, nickname: '손님' });
  expect(res).toEqual({ ok: true, playerId: 'p2' });
  expect((await hostUpdate).players.map((p) => p.nickname)).toEqual(['방장', '손님']);
});

test('실패하면 ok:false와 오류 코드가 온다', async () => {
  const client = await connect();
  const res = await request(client, 'room:join', { roomId: '000000', nickname: 'a' });
  expect(res).toEqual({ ok: false, code: 'ROOM_NOT_FOUND', message: expect.any(String) });
});

test('방장이 시작하면 status가 playing이 되고 시작 함수가 불린다', async () => {
  const host = await connect();
  const { roomId } = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  const guest = await connect();
  await request(guest, 'room:join', { roomId, nickname: '손님' });

  const notHost = await request(guest, 'room:start', { roomId });
  expect(notHost.code).toBe('NOT_HOST');

  const update = nextUpdate(guest);
  expect(await request(host, 'room:start', { roomId })).toEqual({ ok: true });
  expect((await update).status).toBe('playing');
  expect(started).toEqual([roomId]);
});

test('대기실에서 방장이 나가면 남은 사람에게 방장이 넘어간다', async () => {
  const host = await connect();
  const { roomId } = await request(host, 'room:create', { nickname: '방장', mode: 'battle' });
  const guest = await connect();
  await request(guest, 'room:join', { roomId, nickname: '손님' });

  const update = nextUpdate(guest);
  host.close();
  const state = await update;
  expect(state.hostId).toBe('p2');
  expect(state.players.map((p) => p.playerId)).toEqual(['p2']);
});
