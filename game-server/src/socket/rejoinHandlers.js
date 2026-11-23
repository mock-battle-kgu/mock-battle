// room:rejoin: 새로고침·연결 끊김 뒤 같은 참가자로 다시 들어오기 (docs/protocol.md 2-1, v0.3)
// 화면은 room:create·room:join 응답의 token을 저장해 두었다가, 새로 연결되면 이 요청을 보낸다.
const { respond: baseRespond } = require('./respond');
const { broadcastRoom } = require('./roomHandlers');

function registerRejoinHandlers({ io, rooms, games, logger }) {
  const respond = (ack, work) => baseRespond(ack, work, logger);

  io.on('connection', (socket) => {
    socket.on('room:rejoin', (payload = {}, ack) => {
      let rejoined = null;
      respond(ack, () => {
        const { room, player, oldSocketId } = rooms.rejoin({
          roomId: payload.roomId,
          playerId: payload.playerId,
          token: payload.token,
          socketId: socket.id,
        });
        // 예전 탭이 아직 열려 있으면 방 알림을 그만 받게 한다 (주문은 소켓 확인으로 이미 막힘)
        if (oldSocketId && oldSocketId !== socket.id) io.in(oldSocketId).socketsLeave(room.roomId);
        socket.join(room.roomId);
        socket.data.roomId = room.roomId;
        socket.data.playerId = player.playerId;
        broadcastRoom(io, room); // connected: true로 바뀐 것을 방 전체에 알림
        logger?.info({ roomId: room.roomId, playerId: player.playerId, status: room.status }, 'player rejoined');
        rejoined = { roomId: room.roomId, playerId: player.playerId };
        return { roomId: room.roomId, playerId: player.playerId, mode: room.mode, status: room.status };
      });
      // 응답을 먼저 보내고, 게임 중(또는 막 끝난 방)이면 지금 상태를 보낸다
      if (rejoined) games.resume({ ...rejoined, socketId: socket.id });
    });
  });
}

module.exports = { registerRejoinHandlers };
