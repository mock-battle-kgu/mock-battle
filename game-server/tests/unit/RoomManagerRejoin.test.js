const { RoomManager } = require('../../src/game/RoomManager');

const codeOf = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return 'NO_ERROR';
};

function playingRoom() {
  const rooms = new RoomManager();
  const { room, player: host } = rooms.createRoom({ nickname: '방장', mode: 'battle', socketId: 's1' });
  const { player: guest } = rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.startRoom({ roomId: room.roomId, playerId: 'p1', socketId: 's1' });
  return { rooms, room, host, guest };
}

test('입장하면 참가자마다 서로 다른 32자리 token을 받는다', () => {
  const { host, guest } = playingRoom();
  expect(host.token).toMatch(/^[0-9a-f]{32}$/);
  expect(guest.token).not.toBe(host.token);
});

test('room:update 형식에는 token이 없다', () => {
  const { room } = playingRoom();
  expect(JSON.stringify(RoomManager.publicState(room))).not.toContain('token');
});

test('게임 중 끊겼다가 맞는 token으로 돌아오면 새 소켓에 다시 묶인다', () => {
  const { rooms, room, guest } = playingRoom();
  rooms.leave('s2');
  expect(guest.connected).toBe(false);
  const res = rooms.rejoin({ roomId: room.roomId, playerId: 'p2', token: guest.token, socketId: 's2-new' });
  expect(res.oldSocketId).toBe('s2');
  expect(guest).toMatchObject({ socketId: 's2-new', connected: true });
  expect(rooms.findBySocket('s2-new')).toBe(room);
  expect(rooms.findBySocket('s2')).toBeNull();
});

test('token이 틀리거나 없으면 REJOIN_FAILED, 없는 방이면 ROOM_NOT_FOUND', () => {
  const { rooms, room, host } = playingRoom();
  expect(codeOf(() => rooms.rejoin({ roomId: room.roomId, playerId: 'p2', token: host.token, socketId: 'x' }))).toBe('REJOIN_FAILED');
  expect(codeOf(() => rooms.rejoin({ roomId: room.roomId, playerId: 'p2', socketId: 'x' }))).toBe('REJOIN_FAILED');
  expect(codeOf(() => rooms.rejoin({ roomId: room.roomId, playerId: 'p9', token: 'a', socketId: 'x' }))).toBe('REJOIN_FAILED');
  expect(codeOf(() => rooms.rejoin({ roomId: '000000', playerId: 'p1', token: host.token, socketId: 'x' }))).toBe('ROOM_NOT_FOUND');
});

test('대기 중에 끊긴 참가자는 목록에서 빠졌으므로 돌아올 수 없다', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ nickname: '방장', mode: 'battle', socketId: 's1' });
  const { player: guest } = rooms.joinRoom({ roomId: room.roomId, nickname: '손님', socketId: 's2' });
  rooms.leave('s2');
  expect(codeOf(() => rooms.rejoin({ roomId: room.roomId, playerId: 'p2', token: guest.token, socketId: 'x' }))).toBe('REJOIN_FAILED');
});
