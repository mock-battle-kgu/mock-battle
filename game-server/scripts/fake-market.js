// 시세 엔진 없이 가짜 시세를 1초마다 보내는 개발용 스크립트
// 사용: npm run fake-market            (방 000000)
//       npm run fake-market -- 482913  (원하는 방)
const amqp = require('amqplib');
const { EXCHANGE, KEYS } = require('../src/mq/marketClient');

const url = process.env.RABBITMQ_URL || 'amqp://localhost';
const roomId = process.argv[2] || '000000';
const prices = { GANA: 46000, DARA: 19000, MABA: 33000, SAAH: 71000, JACHA: 12500, KATA: 27000 };

async function main() {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: false });
  console.log(`fake market → room ${roomId} (Ctrl + C로 종료)`);

  let t = 0;
  setInterval(() => {
    t += 1;
    for (const code of Object.keys(prices)) {
      const change = 1 + (Math.random() - 0.5) * 0.01; // ±0.5%
      prices[code] = Math.max(1000, Math.round((prices[code] * change) / 10) * 10);
    }
    const message = { roomId, t, prices, impactPct: {} };
    channel.publish(EXCHANGE, KEYS.tick, Buffer.from(JSON.stringify(message)));
    console.log(t, JSON.stringify(prices));
  }, 1000);
}

main().catch((err) => {
  console.error('RabbitMQ 연결 실패:', err.message);
  process.exit(1);
});
