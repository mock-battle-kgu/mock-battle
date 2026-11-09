// 화면 없이 방 만들기·입장·시작을 직접 해 보는 개발용 스크립트
// 사용: npm run try-room   (게임 서버가 켜져 있어야 함)
// 출력된 PIN으로 다른 창에서 npm run fake-market -- PIN 을 실행하면 price:tick도 보입니다
const { io } = require('socket.io-client');

const url = process.env.GAME_URL || 'http://localhost:4000';
const request = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

async function connect(name) {
  const socket = io(url, { transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  socket.on('room:update', (s) =>
    console.log(`[${name}] room:update`, s.status, s.players.map((p) => p.nickname).join(', ')));
  return socket;
}

async function main() {
  const host = await connect('방장');
  const created = await request(host, 'room:create', { nickname: '방장봇', mode: 'battle' });
  console.log('room:create →', created);
  if (!created.ok) process.exit(1);

  const guest = await connect('손님');
  console.log('room:join →', await request(guest, 'room:join', { roomId: created.roomId, nickname: '손님봇' }));
  console.log('room:start →', await request(host, 'room:start', { roomId: created.roomId }));

  console.log(`\nPIN ${created.roomId} — 다른 창에서: npm run fake-market -- ${created.roomId}`);
  console.log('30초 동안 price:tick을 기다립니다 (Ctrl + C로 종료)\n');
  guest.on('price:tick', (tick) => console.log('price:tick', tick.t, JSON.stringify(tick.prices)));
  setTimeout(() => process.exit(0), 30_000);
}

main().catch((err) => {
  console.error('게임 서버 연결 실패:', err.message);
  process.exit(1);
});
