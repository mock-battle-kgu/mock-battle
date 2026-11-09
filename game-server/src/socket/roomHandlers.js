// room:create / room:join / room:start 요청을 받아 RoomManager로 처리하고,
// 결과를 응답(ack)과 room:update 알림으로 돌려준다 (docs/protocol.md 2장)
const { RoomManager } = require('../game/RoomManager');
const { respond: baseRespond } = require('./respond');

function broadcastRoom(io, room) {
  io.to(room.roomId).emit('room:update', RoomManager.publicState(room));
}

function registerRoomHandlers({ io, rooms, logger, onGameStart = () => {} }) {
  const broadcast = (room) => broadcastRoom(io, room);

  const respond = (ack, work) => baseRespond(ack, work, logger);

  // 이미 다른 방에 있던 소켓이면 먼저 나가게 한다
  const leaveCurrentRoom = (socket) => {
    const result = rooms.leave(socket.id);
    if (!result) return;
    socket.leave(result.room.roomId);
    if (!result.deleted) broadcast(result.room);
  };

  const enter = (socket, room, player) => {
    socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    socket.data.playerId = player.playerId; // 이후 요청은 이 값으로만 사람을 구분
    broadcast(room);
  };

  io.on('connection', (socket) => {
    socket.on('room:create', (payload = {}, ack) => {
      respond(ack, () => {
        leaveCurrentRoom(socket);
        const { room, player } = rooms.createRoom({ ...payload, socketId: socket.id });
        enter(socket, room, player);
        logger?.info({ roomId: room.roomId, mode: room.mode }, 'room created');
        return { roomId: room.roomId, playerId: player.playerId };
      });
    });

    socket.on('room:join', (payload = {}, ack) => {
      respond(ack, () => {
        leaveCurrentRoom(socket);
        const { room, player } = rooms.joinRoom({ ...payload, socketId: socket.id });
        enter(socket, room, player);
        logger?.info({ roomId: room.roomId, playerId: player.playerId }, 'player joined');
        return { playerId: player.playerId };
      });
    });

    socket.on('room:start', (payload = {}, ack) => {
      respond(ack, () => {
        const room = rooms.startRoom({ roomId: payload.roomId, playerId: socket.data.playerId });
        broadcast(room);
        logger?.info({ roomId: room.roomId }, 'game started');
        onGameStart(room); // 시세 엔진 시작 신호, game:start, 타이머 (GameService)
        return {};
      });
    });

    socket.on('disconnect', () => {
      const result = rooms.leave(socket.id);
      if (result && !result.deleted) broadcast(result.room);
    });
  });
}

module.exports = { registerRoomHandlers, broadcastRoom };
