const config = require('./config');
const logger = require('./logger');
const { createApp } = require('./app');
const { MarketClient } = require('./mq/marketClient');
const { connectMarketToSockets } = require('./socket/marketBridge');

async function main() {
  const { server, io } = createApp({ logger });

  const market = new MarketClient({ url: config.rabbitmqUrl, logger });
  await market.connect();
  connectMarketToSockets({ market, io, logger });

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'game-server started');
  });

  // docker compose down 때 깔끔하게 종료
  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    setTimeout(() => process.exit(1), 5000).unref();
    await market.close().catch(() => {});
    io.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err: err.message }, 'failed to start');
  process.exit(1);
});
