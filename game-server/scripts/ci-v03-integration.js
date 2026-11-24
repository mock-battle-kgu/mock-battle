'use strict';

// v0.3 Compose integration check: the API's fixed stock catalog and the
// game-server's real-time fundamentals, shared order book and order fills.
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const gameUrl = process.env.GAME_URL || 'http://localhost';
const apiUrl = process.env.API_URL || 'http://localhost';
const timeoutMs = Number(process.env.CI_TIMEOUT_MS || 90000);
const clients = [];
let deadline;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (predicate, label, limitMs = 18000) => {
  const end = Date.now() + limitMs;
  while (Date.now() < end) {
    if (predicate()) return predicate();
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

async function connectClient(label) {
  const socket = io(gameUrl, { transports: ['websocket'], reconnection: false, timeout: 10000, autoConnect: false });
  clients.push(socket);
  socket.connect();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: connect timeout`)), 10000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

function ack(socket, event, body) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, body, (err, result) => {
      if (err) return reject(new Error(`${event}: ${err.message}`));
      if (!result?.ok) return reject(new Error(`${event}: ${JSON.stringify(result)}`));
      resolve(result);
    });
  });
}

async function checkStocksApi() {
  const response = await fetch(`${apiUrl}/api/stocks`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `GET /api/stocks returned ${response.status}`);
  const data = await response.json();
  assert.ok(Array.isArray(data.stocks), 'Expected { stocks: [...] }');
  assert.equal(data.stocks.length, 6, 'Expected exactly six stocks');
  const codes = data.stocks.map((stock) => stock.code);
  assert.deepEqual(codes, [...codes].sort(), 'Stocks must be ordered by code');
  assert.ok(codes.includes('GANA'), 'Expected GANA stock');
  for (const stock of data.stocks) {
    for (const field of ['code', 'name', 'sector', 'description']) {
      assert.equal(typeof stock[field], 'string', `${stock.code}: ${field} must be a string`);
      assert.ok(stock[field].trim(), `${stock.code}: ${field} must be non-empty`);
    }
  }
  console.log('GET /api/stocks: 6 ordered stocks PASSED');
}

async function checkGame() {
  const host = await connectClient('host');
  const guest = await connectClient('guest');
  const observations = { fundamentals: null, books: null, gameEnd: null, orderbookEvents: 0 };
  let latestTick = -1;
  let orderResult = null;
  let orderError = null;
  let roomId;

  host.on('stock:info', (data) => { observations.fundamentals = data; });
  host.on('game:end', (data) => { observations.gameEnd = data; });
  host.on('orderbook:update', (data) => {
    observations.orderbookEvents += 1;
    observations.books = { ...(observations.books || {}), ...(data?.books || {}) };
    if (typeof data?.t === 'number') latestTick = Math.max(latestTick, data.t);
  });

  const created = await ack(host, 'room:create', { nickname: 'v03-host', mode: 'battle' });
  roomId = created.roomId;
  assert.match(roomId, /^\d{6}$/);
  await ack(guest, 'room:join', { roomId, nickname: 'v03-guest' });
  await ack(host, 'room:start', { roomId });

  await waitFor(() => observations.fundamentals, 'stock:info');
  assert.ok(observations.fundamentals.stocks?.GANA, 'stock:info must contain GANA');
  for (const key of ['eps', 'bps', 'sectorPer']) {
    assert.ok(Number.isFinite(observations.fundamentals.stocks.GANA[key]), `GANA ${key} missing`);
  }
  console.log('stock:info PASSED');

  // Check both acknowledgements before the next 1s market tick refreshes
  // the book. Consuming the entire best ask ensures the next player receives
  // the next, more expensive ask level. Both accounts have 10M starting cash.
  // Wait for the NEXT market tick so the book is fresh when we send orders.
  const fresh = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { host.off('orderbook:update', handler); reject(new Error('Fresh orderbook:update missing')); }, 10000);
    function handler(data) {
      if (!data?.books?.GANA?.asks?.[0]?.qty) return;
      clearTimeout(timer);
      host.off('orderbook:update', handler);
      resolve(data);
    }
    host.on('orderbook:update', handler);
  });
  const book = fresh.books.GANA;
  assert.ok(book.asks.length >= 2 && book.bids.length >= 1, 'Expected both sides of the order book');
  const best = book.asks[0];
  const next = book.asks[1];
  assert.ok(next.price > best.price, 'Ask prices must ascend');
  assert.ok(best.qty > 0 && next.qty > 0, 'Ask levels must have positive quantities');
  assert.ok(best.qty * best.price < 10_000_000, 'Initial order exceeds player cash');

  // The event is dispatched on a live websocket; the first ack is followed
  // immediately by the second to target the same market tick.
  try {
    const tBefore = latestTick;
    const first = await ack(host, 'order:place', { roomId, stock: 'GANA', side: 'buy', qty: best.qty });
    const second = await ack(guest, 'order:place', { roomId, stock: 'GANA', side: 'buy', qty: 1 });
    if (latestTick !== tBefore) {
      throw new Error('A new market tick arrived between two orders; repeat the CI run to test the shared book within one tick');
    }
    assert.ok(Number.isFinite(first.price) && Number.isFinite(second.price), 'Expected average fill prices');
    assert.equal(first.qty, best.qty, 'First player should consume the best ask');
    assert.equal(second.qty, 1, 'Second player should fill one share');
    assert.ok(Array.isArray(first.fills) && first.fills.length > 0, 'Expected first order fill breakdown');
    assert.ok(Array.isArray(second.fills) && second.fills.length > 0, 'Expected second order fill breakdown');
    assert.ok(second.price > first.price, `Second average price (${second.price}) must exceed first (${first.price})`);
    orderResult = { firstPrice: first.price, secondPrice: second.price };
  } catch (error) {
    orderError = error;
  }
  if (orderError) throw orderError;
  await waitFor(() => observations.orderbookEvents >= 3, 'book updates after fills', 10000);
  console.log(`Shared order book PASSED (${orderResult.firstPrice} -> ${orderResult.secondPrice})`);

  // Let the 30-second game finish; the F-stage workflow separately verifies
  // that the result is persisted in the DB.
  await waitFor(() => observations.gameEnd, 'game:end', 45000);
  console.log('v0.3 Socket.IO integration PASSED');
}

(async () => {
  deadline = setTimeout(() => { console.error(`CI timeout after ${timeoutMs}ms`); process.exitCode = 1; for (const c of clients) c.disconnect(); }, timeoutMs);
  try {
    await checkStocksApi();
    await checkGame();
  } catch (err) {
    console.error('v0.3 integration FAILED:', err.stack || err.message);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    for (const c of clients) c.disconnect();
  }
})();
