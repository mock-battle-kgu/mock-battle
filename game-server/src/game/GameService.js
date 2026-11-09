// 한 판의 진행: 시작 신호 → 시세 전달 → 시간 종료 → 정리 (docs/game-design.md 6-2)
// 시계는 시세 엔진의 t를 따르고, 시세가 끊겨도 끝나도록 백업 타이머를 둔다.
const { BATTLE_STOCKS, PRACTICE_STOCKS } = require('./stocks');

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
    random = Math.random,
  }) {
    Object.assign(this, {
      io, market, rooms, logger, durationSec, startCash, rumorCards,
      scenarioIds, backupGraceSec, endedRoomTtlMs, broadcastRoom, random,
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
    if (t >= this.durationSec) this.endGame(roomId, 'time');
  }

  endGame(roomId, reason) {
    const game = this.games.get(roomId);
    if (!game || game.ended) return; // 두 번 끝나지 않게
    game.ended = true;
    clearTimeout(game.backupTimer);

    const room = this.rooms.endRoom(roomId);
    if (room) this.broadcastRoom(room);

    // 순위·루머 공개·연습 모드 종목 공개는 G·J·H단계에서 채운다
    this.io.to(roomId).emit('game:end', { ranks: [], rumors: [], reveal: null });
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
