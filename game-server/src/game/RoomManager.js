// 방 생성·입장·시작·퇴장 규칙 (통신 코드 없음 → 서버 없이 테스트 가능)
const MAX_PLAYERS = 8;
const MIN_BATTLE_PLAYERS = 2;
const MODES = ['battle', 'practice'];

// 방 관련 오류도 공통 GameError를 사용 (RoomError는 기존 이름 유지용)
const { GameError: RoomError } = require('./errors');

class RoomManager {
  constructor({ random = Math.random } = {}) {
    this.rooms = new Map(); // roomId → room
    this.random = random;
  }

  // 000000~999999 중 아직 안 쓰는 번호
  generatePin() {
    for (let i = 0; i < 100; i += 1) {
      const pin = String(Math.floor(this.random() * 1_000_000)).padStart(6, '0');
      if (!this.rooms.has(pin)) return pin;
    }
    throw new RoomError('INTERNAL_ERROR', 'could not generate a free PIN');
  }

  static checkNickname(nickname) {
    const name = typeof nickname === 'string' ? nickname.trim() : '';
    if (name.length < 1 || name.length > 10) {
      throw new RoomError('INVALID_NICKNAME', 'nickname must be 1-10 characters');
    }
    return name;
  }

  createRoom({ nickname, mode, socketId }) {
    const name = RoomManager.checkNickname(nickname);
    if (!MODES.includes(mode)) {
      throw new RoomError('INVALID_MODE', 'mode must be battle or practice');
    }
    const roomId = this.generatePin();
    const player = { playerId: 'p1', nickname: name, socketId, connected: true };
    const room = {
      roomId,
      mode,
      status: 'waiting',
      hostId: player.playerId,
      players: [player],
      nextPlayerNo: 2,
    };
    this.rooms.set(roomId, room);
    return { room, player };
  }

  joinRoom({ roomId, nickname, socketId }) {
    const room = this.rooms.get(String(roomId ?? ''));
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'room not found');
    const name = RoomManager.checkNickname(nickname);
    if (room.status !== 'waiting') throw new RoomError('GAME_STARTED', 'game already started');
    // 연습 모드는 혼자만 사용
    const max = room.mode === 'practice' ? 1 : MAX_PLAYERS;
    if (room.players.length >= max) throw new RoomError('ROOM_FULL', 'room is full');
    if (room.players.some((p) => p.nickname === name)) {
      throw new RoomError('NICKNAME_TAKEN', 'nickname already used in this room');
    }
    const player = { playerId: `p${room.nextPlayerNo}`, nickname: name, socketId, connected: true };
    room.nextPlayerNo += 1;
    room.players.push(player);
    return { room, player };
  }

  startRoom({ roomId, playerId }) {
    const room = this.rooms.get(String(roomId ?? ''));
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'room not found');
    if (room.hostId !== playerId) throw new RoomError('NOT_HOST', 'only the host can start');
    if (room.status !== 'waiting') throw new RoomError('GAME_STARTED', 'game already started');
    if (room.mode === 'battle' && room.players.length < MIN_BATTLE_PLAYERS) {
      throw new RoomError('NOT_ENOUGH_PLAYERS', 'battle needs at least 2 players');
    }
    room.status = 'playing';
    return room;
  }

  // 소켓 연결이 끊겼을 때
  // 대기 중: 목록에서 빼고, 방장이면 다음 사람에게 넘기고, 아무도 없으면 방 삭제
  // 게임 중: 목록에 남겨 두고(보유 주식 유지) 연결 끊김만 표시
  leave(socketId) {
    const room = this.findBySocket(socketId);
    if (!room) return null;

    if (room.status === 'waiting') {
      room.players = room.players.filter((p) => p.socketId !== socketId);
      if (room.players.length === 0) {
        this.rooms.delete(room.roomId);
        return { room, deleted: true };
      }
      if (!room.players.some((p) => p.playerId === room.hostId)) {
        room.hostId = room.players[0].playerId;
      }
      return { room, deleted: false };
    }

    const player = room.players.find((p) => p.socketId === socketId);
    player.connected = false;
    return { room, deleted: false };
  }

  // 게임 종료: 상태만 ended로 바꾼다 (참가자 목록은 결과 화면을 위해 유지)
  endRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) room.status = 'ended';
    return room ?? null;
  }

  remove(roomId) {
    return this.rooms.delete(roomId);
  }

  findBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId && p.connected)) return room;
    }
    return null;
  }

  get(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  // room:update로 보내는 형식 (socketId 같은 내부 값은 숨김)
  static publicState(room) {
    return {
      roomId: room.roomId,
      mode: room.mode,
      hostId: room.hostId,
      status: room.status,
      players: room.players.map(({ playerId, nickname, connected }) => ({ playerId, nickname, connected })),
    };
  }
}

module.exports = { RoomManager, RoomError, MAX_PLAYERS, MIN_BATTLE_PLAYERS };
