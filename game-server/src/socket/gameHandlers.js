// 게임 중 요청 처리 (docs/protocol.md 2-1). 방과 참가자는 소켓에 묶인 값으로만 판단
const { respond } = require('./respond');
const { GameError } = require('../game/errors');

function registerGameHandlers({ io, games, logger }) {
  io.on('connection', (socket) => {
    socket.on('order:place', (payload = {}, ack) => {
      respond(ack, () => {
        // 방을 나갔거나 연결이 끊긴 참가자는 주문할 수 없다
        const room = games.rooms.findBySocket(socket.id);
        if (!room || room.roomId !== socket.data.roomId) {
          throw new GameError('GAME_NOT_PLAYING', 'player is not in this game');
        }
        return games.placeOrder({
          roomId: socket.data.roomId,
          playerId: socket.data.playerId,
          stock: payload.stock,
          side: payload.side,
          qty: payload.qty,
        });
      }, logger);
    });
  });
}

module.exports = { registerGameHandlers };