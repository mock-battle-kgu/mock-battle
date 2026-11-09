// 게임 중 요청 처리 (docs/protocol.md 2-1). 방과 참가자는 소켓에 묶인 값으로만 판단
const { respond } = require('./respond');

function registerGameHandlers({ io, games, logger }) {
  io.on('connection', (socket) => {
    socket.on('order:place', (payload = {}, ack) => {
      respond(ack, () => games.placeOrder({
        roomId: socket.data.roomId,
        playerId: socket.data.playerId,
        stock: payload.stock,
        side: payload.side,
        qty: payload.qty,
      }), logger);
    });
  });
}

module.exports = { registerGameHandlers };
