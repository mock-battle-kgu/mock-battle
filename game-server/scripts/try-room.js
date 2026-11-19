// 화면 없이 한 판을 처음부터 끝까지 돌려 보는 개발용 스크립트
// 사용: npm run try-room                    (대결 모드, 봇 2명)
//       $env:TRY_MODE="practice"; npm run try-room   (연습 모드, 봇 1명)
// 게임 서버와 fake-market(또는 시세 엔진)이 켜져 있어야 시세가 들어옵니다.
const { io } = require('socket.io-client');

const url = process.env.GAME_URL || 'http://localhost:4000';
const mode = process.env.TRY_MODE === 'practice' ? 'practice' : 'battle';
const request = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

async function connect(name) {
  const socket = io(url, { transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  socket.on('room:update', (s) =>
    console.log(`[${name}] room:update ${s.status} (${s.players.map((p) => p.nickname).join(', ')})`));
  return socket;
}

async function main() {
  const host = await connect('방장');
  const created = await request(host, 'room:create', { nickname: '방장봇', mode });
  console.log('room:create →', created);
  if (!created.ok) process.exit(1);

  if (mode === 'battle') {
    const guest = await connect('손님');
    console.log('room:join →', await request(guest, 'room:join', { roomId: created.roomId, nickname: '손님봇' }));
  }

  host.on('game:start', (g) =>
    console.log(`game:start → ${g.mode}, ${g.durationSec}초, 시작 자금 ${g.startCash}, 종목 ${g.stocks.map((s) => s.code).join(', ')}`));
  host.on('price:tick', (tick) => console.log(`price:tick t=${tick.t}`, JSON.stringify(tick.prices)));
  host.on('candle:close', (c) => {
    const [code, k] = Object.entries(c.candles)[0];
    console.log(`  candle:close t=${c.t} ${code} 시${k.o} 고${k.h} 저${k.l} 종${k.c} (종목 ${Object.keys(c.candles).length}개)`);
  });
  host.on('rank:update', (r) => {
    if (r.t % 5 === 0) console.log(`  rank:update t=${r.t}`, r.ranks.map((x) => `${x.rank}위 ${x.nickname} ${x.returnPct}%`).join(' / '));
  });
  host.on('portfolio:update', (p) => {
    lastPortfolio = p;
  });
  host.on('game:end', (end) => {
    console.log('  내 계좌(마지막) →', JSON.stringify(lastPortfolio));
    if (end.reveal) console.log('game:end 정체 공개 →', JSON.stringify(end.reveal));
    console.log('game:end 최종 순위 →', end.ranks.map((x) => `${x.rank}위 ${x.nickname} ${x.returnPct}% (${x.totalAsset}원)`).join(' / '));
    setTimeout(() => process.exit(0), 500);
  });

  let lastPortfolio = null;
  // 시세가 들어오기 시작하면 주문을 몇 번 넣어 본다
  const stock = mode === 'battle' ? 'GANA' : 'STOCK_A';
  const orders = {
    2: { stock, side: 'buy', qty: 100 },
    4: { stock, side: 'sell', qty: 40 },
    6: { stock, side: 'buy', qty: 100000 }, // 현금 부족
    8: { stock, side: 'sell', qty: 1000 },  // 보유 부족
  };
  host.on('price:tick', async (tick) => {
    const order = orders[tick.t];
    if (!order) return;
    console.log(`  order:place ${order.side} ${order.qty}주 →`, await request(host, 'order:place', order));
    console.log('  portfolio:update →', JSON.stringify(lastPortfolio));
  });

  console.log('room:start →', await request(host, 'room:start', { roomId: created.roomId }));
  console.log(`\nPIN ${created.roomId} — game:end가 올 때까지 기다립니다 (Ctrl + C로 종료)\n`);
}

main().catch((err) => {
  console.error('게임 서버 연결 실패:', err.message);
  process.exit(1);
});
