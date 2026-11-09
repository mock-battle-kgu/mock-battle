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
  host.on('game:end', (end) => {
    console.log('game:end →', JSON.stringify(end));
    setTimeout(() => process.exit(0), 500);
  });

  console.log('room:start →', await request(host, 'room:start', { roomId: created.roomId }));
  console.log(`\nPIN ${created.roomId} — game:end가 올 때까지 기다립니다 (Ctrl + C로 종료)\n`);
}

main().catch((err) => {
  console.error('게임 서버 연결 실패:', err.message);
  process.exit(1);
});
