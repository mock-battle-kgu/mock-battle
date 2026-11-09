// 시세 엔진 대신 가짜 시세를 보내는 개발용 스크립트
// 사용: npm run fake-market            → 시세 엔진처럼 market.control을 듣고,
//                                         게임이 시작되면 그 방에 t=0부터 1초마다 시세 전송, 시간이 되면 멈춤
//       npm run fake-market -- 482913  → 지정한 방에 바로 시세 전송 (B단계 방식)
// 주의: 실제 시세 엔진이 시세를 보내는 중이면 같이 켜지 마세요 (가격이 두 군데서 들어옴)
const amqp = require('amqplib');
const { EXCHANGE, KEYS } = require('../src/mq/marketClient');

const url = process.env.RABBITMQ_URL || 'amqp://localhost';
const fixedRoomId = process.argv[2];
const BASE = { GANA: 46000, DARA: 19000, MABA: 33000, SAAH: 71000, JACHA: 12500, KATA: 27000, STOCK_A: 10000 };
const running = new Map(); // roomId → interval

function move(prices) {
  for (const code of Object.keys(prices)) {
    const change = 1 + (Math.random() - 0.5) * 0.01; // ±0.5%
    prices[code] = Math.max(1000, Math.round((prices[code] * change) / 10) * 10);
  }
}

function startRoom(channel, { roomId, stocks, durationSec }) {
  if (running.has(roomId)) return;
  const codes = Array.isArray(stocks) && stocks.length > 0 ? stocks : ['STOCK_A'];
  const prices = Object.fromEntries(codes.map((c) => [c, BASE[c] ?? 10000]));
  let t = 0;
  const send = () => {
    channel.publish(EXCHANGE, KEYS.tick, Buffer.from(JSON.stringify({ roomId, t, prices, impactPct: {} })));
    console.log(`[${roomId}] t=${t}`, JSON.stringify(prices));
  };
  send(); // 시세 엔진처럼 t=0을 바로 보냄
  running.set(roomId, setInterval(() => {
    t += 1;
    move(prices);
    send();
    if (durationSec && t >= durationSec) stopRoom(roomId, 'time');
  }, 1000));
  console.log(`[${roomId}] 시작 (${codes.join(', ')}${durationSec ? `, ${durationSec}초` : ''})`);
}

function stopRoom(roomId, reason) {
  if (!running.has(roomId)) return;
  clearInterval(running.get(roomId));
  running.delete(roomId);
  console.log(`[${roomId}] 종료 (${reason})`);
}

async function main() {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  if (fixedRoomId) {
    startRoom(channel, { roomId: fixedRoomId, stocks: Object.keys(BASE).filter((c) => c !== 'STOCK_A') });
    return;
  }

  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, EXCHANGE, KEYS.control);
  await channel.consume(queue, (msg) => {
    if (!msg) return;
    const control = JSON.parse(msg.content.toString());
    if (control.type === 'start') startRoom(channel, control);
    if (control.type === 'stop') stopRoom(control.roomId, 'stop 신호');
  }, { noAck: true });
  console.log('가짜 시세 엔진 대기 중: 게임이 시작되면 자동으로 시세를 보냅니다 (Ctrl + C로 종료)');
}

main().catch((err) => {
  console.error('RabbitMQ 연결 실패:', err.message);
  process.exit(1);
});
