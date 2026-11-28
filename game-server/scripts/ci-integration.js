const fs = require('node:fs');
const { io } = require('socket.io-client');

const url = process.env.GAME_URL || 'http://localhost';
const sockets = [];
const timeoutMs = 100000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000
    });

    sockets.push(socket);

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket.IO connection timeout'));
    }, 12000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function request(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(10000).emit(event, payload, (err, response) => {
      if (err) return reject(new Error(`${event}: timeout`));
      if (!response?.ok) {
        return reject(new Error(
          `${event}: ${JSON.stringify(response)}`
        ));
      }
      resolve(response);
    });
  });
}

async function main() {
  const host = await connect();
  const guest = await connect();

  const created = await request(host, 'room:create', {
    nickname: 'CIHost',
    mode: 'battle'
  });

  const roomId = created.roomId;
  assert(/^\d{6}$/.test(roomId), 'Invalid roomId');

  const joined = await request(guest, 'room:join', {
    roomId,
    nickname: 'CIGuest'
  });

  assert(joined.playerId, 'Guest playerId missing');

  console.log(`Room created: ${roomId}`);

  let gameStarted = false;
  let tickCount = 0;
  let candleCount = 0;

  const finished = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('game:end timeout'));
    }, timeoutMs);

    host.on('game:start', data => {
      assert(data.mode === 'battle', 'Wrong game mode');
      gameStarted = true;
    });

    host.on('price:tick', () => {
      tickCount++;
    });

    host.on('candle:close', () => {
      candleCount++;
    });

    host.once('game:end', data => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  await request(host, 'room:start', { roomId });

  const result = await finished;

  assert(gameStarted, 'game:start not received');
  assert(tickCount > 0, 'No price:tick received');
  assert(candleCount > 0, 'No candle:close received');
  assert(Array.isArray(result.ranks), 'Missing final ranks');
  assert(result.ranks.length === 2, 'Expected two final players');

  console.log(`Ticks received: ${tickCount}`);
  console.log(`Candles received: ${candleCount}`);
  console.log(`Final ranks: ${result.ranks.length}`);
  console.log('Socket.IO integration test PASSED');

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `room_id=${roomId}\n`
    );
  }
}

main()
  .catch(err => {
    console.error('Integration test FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    sockets.forEach(socket => socket.disconnect());
  });
