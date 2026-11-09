const { RoomManager, RoomError } = require('../../src/game/RoomManager');

const expectCode = (fn, code) => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(RoomError);
    expect(err.code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
};

const battleRoom = (rooms) => rooms.createRoom({ nickname: '방장', mode: 'battle', socketId: 's1' }).room;
const join = (rooms, room, n) =>
  rooms.joinRoom({ roomId: room.roomId, nickname: `참가${n}`, socketId: `s${n}` });

describe('방 만들기', () => {
  test('6자리 PIN과 방장 p1이 생긴다', () => {
    const rooms = new RoomManager();
    const { room, player } = rooms.createRoom({ nickname: ' 단타의신 ', mode: 'battle', socketId: 's1' });
    expect(room.roomId).toMatch(/^\d{6}$/);
    expect(player.playerId).toBe('p1');
    expect(player.nickname).toBe('단타의신'); // 앞뒤 공백 제거
    expect(room.hostId).toBe('p1');
    expect(room.status).toBe('waiting');
  });

  test('이미 쓰는 PIN은 다시 뽑는다', () => {
    const values = [0.1, 0.1, 0.2];
    const rooms = new RoomManager({ random: () => values.shift() });
    const a = rooms.createRoom({ nickname: 'a', mode: 'battle', socketId: 's1' }).room;
    const b = rooms.createRoom({ nickname: 'b', mode: 'battle', socketId: 's2' }).room;
    expect(a.roomId).not.toBe(b.roomId);
  });

  test('닉네임이 비었거나 10자를 넘으면 거부', () => {
    const rooms = new RoomManager();
    expectCode(() => rooms.createRoom({ nickname: '  ', mode: 'battle' }), 'INVALID_NICKNAME');
    expectCode(() => rooms.createRoom({ nickname: '12345678901', mode: 'battle' }), 'INVALID_NICKNAME');
  });

  test('mode가 battle·practice가 아니면 거부', () => {
    const rooms = new RoomManager();
    expectCode(() => rooms.createRoom({ nickname: 'a' }), 'INVALID_MODE');
  });
});

describe('방 입장', () => {
  test('p2, p3 순서로 번호를 받는다', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    expect(join(rooms, room, 2).player.playerId).toBe('p2');
    expect(join(rooms, room, 3).player.playerId).toBe('p3');
  });

  test('없는 PIN, 같은 닉네임, 9번째 입장, 시작된 방은 거부', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    expectCode(() => rooms.joinRoom({ roomId: '999999x', nickname: 'a' }), 'ROOM_NOT_FOUND');
    expectCode(() => rooms.joinRoom({ roomId: room.roomId, nickname: '방장' }), 'NICKNAME_TAKEN');
    for (let n = 2; n <= 8; n += 1) join(rooms, room, n);
    expectCode(() => join(rooms, room, 9), 'ROOM_FULL');

    const other = battleRoom(rooms);
    join(rooms, other, 2);
    rooms.startRoom({ roomId: other.roomId, playerId: 'p1' });
    expectCode(() => join(rooms, other, 3), 'GAME_STARTED');
  });

  test('연습 모드 방에는 다른 사람이 들어올 수 없다', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom({ nickname: 'a', mode: 'practice', socketId: 's1' });
    expectCode(() => join(rooms, room, 2), 'ROOM_FULL');
  });
});

describe('게임 시작', () => {
  test('방장만, 대결은 2명 이상일 때 시작된다', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    expectCode(() => rooms.startRoom({ roomId: room.roomId, playerId: 'p1' }), 'NOT_ENOUGH_PLAYERS');
    join(rooms, room, 2);
    expectCode(() => rooms.startRoom({ roomId: room.roomId, playerId: 'p2' }), 'NOT_HOST');
    rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });
    expect(room.status).toBe('playing');
    expectCode(() => rooms.startRoom({ roomId: room.roomId, playerId: 'p1' }), 'GAME_STARTED');
  });

  test('연습 모드는 혼자서 시작된다', () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom({ nickname: 'a', mode: 'practice', socketId: 's1' });
    rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });
    expect(room.status).toBe('playing');
  });
});

describe('퇴장', () => {
  test('대기 중 방장이 나가면 다음 사람이 방장', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    join(rooms, room, 2);
    const result = rooms.leave('s1');
    expect(result.deleted).toBe(false);
    expect(room.hostId).toBe('p2');
    expect(room.players.map((p) => p.playerId)).toEqual(['p2']);
  });

  test('대기 중 모두 나가면 방이 삭제된다', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    expect(rooms.leave('s1').deleted).toBe(true);
    expect(rooms.get(room.roomId)).toBeNull();
  });

  test('게임 중에 나가면 순위에 남고 연결 끊김만 표시', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    join(rooms, room, 2);
    rooms.startRoom({ roomId: room.roomId, playerId: 'p1' });
    rooms.leave('s2');
    expect(room.players).toHaveLength(2);
    expect(room.players[1].connected).toBe(false);
  });

  test('room:update 형식에는 socketId가 없다', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    const state = RoomManager.publicState(room);
    expect(state).toEqual({
      roomId: room.roomId,
      mode: 'battle',
      hostId: 'p1',
      status: 'waiting',
      players: [{ playerId: 'p1', nickname: '방장', connected: true }],
    });
  });
});

describe('종료와 삭제', () => {
  test('endRoom은 상태를 ended로, remove는 방을 지운다', () => {
    const rooms = new RoomManager();
    const room = battleRoom(rooms);
    rooms.endRoom(room.roomId);
    expect(room.status).toBe('ended');
    rooms.remove(room.roomId);
    expect(rooms.get(room.roomId)).toBeNull();
  });
});
