const { io: connectClient } = require('socket.io-client');
const { createApp } = require('../../src/app');

let server;
let io;
let baseUrl;

beforeEach(async () => {
  ({ server, io } = createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => io.close(resolve));
});

test('GET /health 는 ok를 돌려준다', async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('Socket.IO 클라이언트가 접속할 수 있다', async () => {
  const client = connectClient(baseUrl, { transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('connect_error', reject);
  });
  expect(client.connected).toBe(true);
  client.close();
});
