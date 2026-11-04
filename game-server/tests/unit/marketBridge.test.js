const { io: connectClient } = require('socket.io-client');
const { createApp } = require('../../src/app');
const { connectMarketToSockets } = require('../../src/socket/marketBridge');

let server;
let io;
let url;
let sendTick;
const clients = [];

beforeEach(async () => {
  ({ server, io } = createApp());
  // 테스트에서만: 접속할 때 query.room 방에 넣는다 (실제 입장은 C단계 room:join)
  io.on('connection', (socket) => socket.join(socket.handshake.query.room));
  const market = { onTick: (fn) => { sendTick = fn; } };
  connectMarketToSockets({ market, io });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await new Promise((resolve) => io.close(resolve));
});

async function join(room) {
  const client = connectClient(url, { transports: ['websocket'], query: { room } });
  clients.push(client);
  await new Promise((resolve) => client.on('connect', resolve));
  return client;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('tick을 해당 방에만 price:tick으로 보낸다', async () => {
  const inRoom = await join('482913');
  const otherRoom = await join('111111');
  const received = [];
  let otherReceived = false;
  inRoom.on('price:tick', (data) => received.push(data));
  otherRoom.on('price:tick', () => { otherReceived = true; });

  sendTick({ roomId: '482913', t: 1, prices: { GANA: 46000 }, impactPct: { GANA: 0.5 } });
  await wait(100);

  // 화면에는 protocol.md 형식대로 t와 prices만 보낸다
  expect(received).toEqual([{ t: 1, prices: { GANA: 46000 } }]);
  expect(otherReceived).toBe(false);
});

test('roomId가 없는 tick은 보내지 않는다', async () => {
  const client = await join('482913');
  let got = false;
  client.on('price:tick', () => { got = true; });
  sendTick({ t: 1, prices: { GANA: 46000 } });
  await wait(100);
  expect(got).toBe(false);
});
