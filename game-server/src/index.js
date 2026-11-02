const config = require('./config');
const logger = require('./logger');
const { createApp } = require('./app');

const { server, io } = createApp({ logger });

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'game-server started');
});

// docker compose down 때 깔끔하게 종료
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
