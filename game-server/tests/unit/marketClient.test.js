const { MarketClient, EXCHANGE, KEYS } = require('../../src/mq/marketClient');

// 진짜 RabbitMQ 없이 테스트하기 위한 가짜 연결
function fakeAmqp() {
  const channel = {
    consumer: null,
    published: [],
    assertExchange: jest.fn(async () => {}),
    assertQueue: jest.fn(async () => ({ queue: 'q1' })),
    bindQueue: jest.fn(async () => {}),
    consume: jest.fn(async (queue, fn) => {
      channel.consumer = fn;
    }),
    publish: jest.fn((exchange, key, buffer) => {
      channel.published.push({ exchange, key, body: JSON.parse(buffer.toString()) });
      return true;
    }),
    close: jest.fn(async () => {}),
  };
  const connection = {
    createChannel: jest.fn(async () => channel),
    on: jest.fn(),
    close: jest.fn(async () => {}),
  };
  return { channel, connection };
}

const deliver = (channel, key, content) =>
  channel.consumer({ fields: { routingKey: key }, content: Buffer.from(content) });

async function connected() {
  const { channel, connection } = fakeAmqp();
  const client = new MarketClient({ connectFn: async () => connection, retryDelayMs: 1 });
  await client.connect();
  return { client, channel };
}

test('연결에 실패하면 다시 시도해서 성공한다', async () => {
  const { connection } = fakeAmqp();
  const connectFn = jest
    .fn()
    .mockRejectedValueOnce(new Error('refused'))
    .mockRejectedValueOnce(new Error('refused'))
    .mockResolvedValue(connection);
  const client = new MarketClient({ connectFn, retries: 5, retryDelayMs: 1 });
  await client.connect();
  expect(connectFn).toHaveBeenCalledTimes(3);
});

test('정해진 횟수를 모두 실패하면 오류를 던진다', async () => {
  const connectFn = jest.fn().mockRejectedValue(new Error('refused'));
  const client = new MarketClient({ connectFn, retries: 2, retryDelayMs: 1 });
  await expect(client.connect()).rejects.toThrow('refused');
  expect(connectFn).toHaveBeenCalledTimes(2);
});

test('market exchange를 만들고 tick, news를 구독한다', async () => {
  const { channel } = await connected();
  expect(channel.assertExchange).toHaveBeenCalledWith(EXCHANGE, 'topic', { durable: false });
  expect(channel.bindQueue).toHaveBeenCalledWith('q1', EXCHANGE, KEYS.tick);
  expect(channel.bindQueue).toHaveBeenCalledWith('q1', EXCHANGE, KEYS.news);
});

test('tick과 news를 각각 등록한 함수로 전달한다', async () => {
  const { client, channel } = await connected();
  const ticks = [];
  const news = [];
  client.onTick((m) => ticks.push(m));
  client.onNews((m) => news.push(m));

  deliver(channel, KEYS.tick, JSON.stringify({ roomId: '482913', t: 1, prices: { GANA: 46000 } }));
  deliver(channel, KEYS.news, JSON.stringify({ roomId: '482913', t: 2, stock: 'GANA', headline: 'h' }));

  expect(ticks).toEqual([{ roomId: '482913', t: 1, prices: { GANA: 46000 } }]);
  expect(news).toHaveLength(1);
});

test('잘못된 JSON은 무시한다', async () => {
  const { client, channel } = await connected();
  const ticks = [];
  client.onTick((m) => ticks.push(m));
  deliver(channel, KEYS.tick, '{not json');
  expect(ticks).toHaveLength(0);
});

test('control과 flow를 정해진 경로로 보낸다', async () => {
  const { client, channel } = await connected();
  client.publishControl({ type: 'start', roomId: '482913' });
  client.publishFlow({ roomId: '482913', t: 3, netQty: { GANA: 10 } });
  expect(channel.published).toEqual([
    { exchange: EXCHANGE, key: KEYS.control, body: { type: 'start', roomId: '482913' } },
    { exchange: EXCHANGE, key: KEYS.flow, body: { roomId: '482913', t: 3, netQty: { GANA: 10 } } },
  ]);
});

test('연결 전에 보내면 오류가 난다', () => {
  const client = new MarketClient({});
  expect(() => client.publishControl({ type: 'stop' })).toThrow('not connected');
});
