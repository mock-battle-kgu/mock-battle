const config = require('./config');
const logger = require('./logger');
const { createApp } = require('./app');
const { MarketClient } = require('./mq/marketClient');
const { RoomManager } = require('./game/RoomManager');
const { GameService } = require('./game/GameService');
const { registerRoomHandlers, broadcastRoom } = require('./socket/roomHandlers');
const { registerGameHandlers } = require('./socket/gameHandlers');

async function main() {
  const { server, io } = createApp({ logger });

  const market = new MarketClient({ url: config.rabbitmqUrl, logger });
  await market.connect();

  const rooms = new RoomManager();
  const games = new GameService({
    io,
    market,
    rooms,
    logger,
    durationSec: config.gameDurationSec,
    startCash: config.startCash,
    rumorCards: config.rumorCards,
    candleTicks: config.candleTicks,
    scenarioIds: config.scenarioIds,
    backupGraceSec: config.backupGraceSec,
    endedRoomTtlMs: config.endedRoomTtlMs,
    broadcastRoom: (room) => broadcastRoom(io, room),
  });

  market.onTick((tick) => games.handleTick(tick));
  registerRoomHandlers({ io, rooms, logger, onGameStart: (room) => games.startGame(room) });
  registerGameHandlers({ io, games, logger });

  server.listen(config.port, () => {
    logger.info({ port: config.port, gameDurationSec: config.gameDurationSec }, 'game-server started');
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
