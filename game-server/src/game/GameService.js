// 한 판의 진행: 시작 신호 → 시세 전달 → 시간 종료 → 정리 (docs/game-design.md 6-2)
// 시계는 시세 엔진의 t를 따르고, 시세가 끊겨도 끝나도록 백업 타이머를 둔다.
const { BATTLE_STOCKS, PRACTICE_STOCKS } = require('./stocks');
const { CandleBuilder } = require('./CandleBuilder');
const { Portfolio } = require('./Portfolio');
const { GameError } = require('./errors');
const { rankPlayers } = require('./Ranking');

class GameService {
  constructor({
    io,
    market,
    rooms,
    logger,
    durationSec,
    startCash,
    rumorCards,
    scenarioIds,
    backupGraceSec,
    endedRoomTtlMs,
    broadcastRoom,
    candleTicks = 5,
    random = Math.random,
  }) {
    Object.assign(this, {
      io, market, rooms, logger, durationSec, startCash, rumorCards,
      scenarioIds, backupGraceSec, endedRoomTtlMs, broadcastRoom, candleTicks, random,
    });
    this.games = new Map(); // roomId → 진행 중인 게임
  }

  startGame(room) {
    const isBattle = room.mode === 'battle';
    const stocks = isBattle ? BATTLE_STOCKS : PRACTICE_STOCKS;
    const game = {
      roomId: room.roomId,
      mode: room.mode,
      t: 0,
      prices: {},
      ended: false,
      scenarioId: isBattle ? null : this.pickScenario(),
      candleBuilder: new CandleBuilder(this.candleTicks),
      candles: [], // 완성된 캔들 기록 (결과 화면·복기용)
      stockCodes: stocks.map((s) => s.code),
      // 참가자마다 시작 자금으로 계좌를 만든다
      portfolios: new Map(room.players.map((p) => [p.playerId, new Portfolio(this.startCash)])),
      orders: [], // 체결 기록 (플레이어 시장 영향·결과 분석용)
      backupTimer: null,
    };
    this.games.set(room.roomId, game);

    // 참가자 전원에게 게임 시작 알림을 먼저 보낸다 (시작가는 곧 오는 t=0 price:tick으로 전달)
    this.io.to(room.roomId).emit('game:start', {
      mode: room.mode,
      durationSec: this.durationSec,
      startCash: this.startCash,
      rumorCards: isBattle ? this.rumorCards : 0,
      stocks: stocks.map(({ code, name }) => ({ code, name })),
    });

    // 시세 엔진에 시장 시작 신호 (protocol.md 3장 market.control)
    const control = { type: 'start', roomId: room.roomId, mode: room.mode, durationSec: this.durationSec };
    if (isBattle) control.stocks = stocks.map((s) => s.code);
    else control.scenarioId = game.scenarioId;
    this.market.publishControl(control);

    game.backupTimer = setTimeout(
      () => this.endGame(room.roomId, 'backup-timer'),
      (this.durationSec + this.backupGraceSec) * 1000,
    );
    this.logger?.info({ roomId: room.roomId, mode: room.mode, scenarioId: game.scenarioId }, 'game started');
  }

  pickScenario() {
    return this.scenarioIds[Math.floor(this.random() * this.scenarioIds.length)];
  }

  // 시세 엔진의 market.tick 처리
  handleTick({ roomId, t, prices }) {
    const game = this.games.get(roomId);
    if (!game || game.ended || !prices) return;
    game.t = t;
    game.prices = { ...game.prices, ...prices };
    this.io.to(roomId).emit('price:tick', { t, prices });
    this.emitCandle(game, game.candleBuilder.add(t, prices));
    this.emitStandings(game);
    if (t >= this.durationSec) this.endGame(roomId, 'time');
  }

  players(game) {
    return this.rooms.get(game.roomId)?.players ?? [];
  }

  // 참가자 한 명에게 내 계좌 상태 (protocol.md portfolio:update)
  emitPortfolio(game, player) {
    if (!player.connected) return;
    const portfolio = game.portfolios.get(player.playerId);
    if (portfolio) this.io.to(player.socketId).emit('portfolio:update', portfolio.snapshot(game.prices));
  }

  // 1초마다: 각자에게 portfolio:update, 대결 모드는 방 전체에 rank:update
  emitStandings(game) {
    const players = this.players(game);
    for (const player of players) this.emitPortfolio(game, player);
    if (game.mode !== 'battle') return;
    const ranks = rankPlayers(players, game.portfolios, game.prices)
      .map(({ rank, playerId, nickname, returnPct }) => ({ rank, playerId, nickname, returnPct }));
    this.io.to(game.roomId).emit('rank:update', { t: game.t, ranks });
  }

  // order:place 처리: 서버가 가진 최신 시세로 즉시 체결 (화면이 보낸 가격은 받지 않음)
  placeOrder({ roomId, playerId, stock, side, qty }) {
    const game = this.games.get(roomId);
    if (!game || game.ended) throw new GameError('GAME_NOT_PLAYING', 'game is not playing');
    const portfolio = game.portfolios.get(playerId);
    if (!portfolio) throw new GameError('GAME_NOT_PLAYING', 'player is not in this game');
    if (!game.stockCodes.includes(stock)) throw new GameError('INVALID_STOCK', 'unknown stock');
    if (side !== 'buy' && side !== 'sell') throw new GameError('INVALID_SIDE', 'side must be buy or sell');
    const price = game.prices[stock];
    if (price === undefined) throw new GameError('GAME_NOT_PLAYING', 'price is not ready yet');

    const result = side === 'buy' ? portfolio.buy(stock, qty, price) : portfolio.sell(stock, qty, price);
    game.orders.push({ t: game.t, playerId, stock, side, qty, price });
    // 체결되면 1초를 기다리지 않고 바로 내 계좌 상태를 보낸다
    const player = this.players(game).find((p) => p.playerId === playerId);
    if (player) this.emitPortfolio(game, player);
    this.logger?.debug({ roomId, playerId, stock, side, qty, price }, 'order filled');
    return result;
  }

  emitCandle(game, closed) {
    if (!closed) return;
    game.candles.push(closed);
    this.io.to(game.roomId).emit('candle:close', closed);
  }

  endGame(roomId, reason) {
    const game = this.games.get(roomId);
    if (!game || game.ended) return; // 두 번 끝나지 않게
    game.ended = true;
    clearTimeout(game.backupTimer);
    // 5초를 다 못 채운 마지막 캔들도 닫아서 보낸다
    this.emitCandle(game, game.candleBuilder.flush(game.t));

    // 마지막 시세로 최종 순위 (J단계에서 API 서버에 저장)
    game.finalRanks = rankPlayers(this.players(game), game.portfolios, game.prices);

    const room = this.rooms.endRoom(roomId);
    if (room) this.broadcastRoom(room);

    // 루머 공개(K단계)·연습 모드 종목 공개(H단계)는 이후 채운다
    this.io.to(roomId).emit('game:end', { ranks: game.finalRanks, rumors: [], reveal: null });
    this.market.publishControl({ type: 'stop', roomId });
    this.logger?.info({ roomId, reason, t: game.t }, 'game ended');

    setTimeout(() => {
      this.games.delete(roomId);
      this.rooms.remove(roomId);
    }, this.endedRoomTtlMs);
  }

  get(roomId) {
    return this.games.get(roomId) ?? null;
  }
}

module.exports = { GameService };
