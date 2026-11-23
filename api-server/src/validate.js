function validateResult(body) {
  // 요청 데이터가 객체인지 확인
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      code: 'INVALID_FIELD',
      message: 'Request body must be an object'
    };
  }

  // 방 번호: 숫자 6자리 문자열
  if (typeof body.roomId !== 'string' ||
      !/^[0-9]{6}$/.test(body.roomId)) {
    return {
      code: 'INVALID_FIELD',
      message: 'roomId must be 6 digits'
    };
  }

  // 게임 모드 검사
  if (!['battle', 'practice'].includes(body.mode)) {
    return {
      code: 'INVALID_FIELD',
      message: 'Invalid game mode'
    };
  }

  // 게임 종료 시간 검사
  if (typeof body.playedAt !== 'string' ||
      Number.isNaN(Date.parse(body.playedAt))) {
    return {
      code: 'INVALID_FIELD',
      message: 'Invalid playedAt'
    };
  }

  // 게임 진행 시간 검사
  if (!Number.isInteger(body.durationSec) ||
      body.durationSec <= 0) {
    return {
      code: 'INVALID_FIELD',
      message: 'Invalid durationSec'
    };
  }

  // 참가자 수 검사
  if (!Array.isArray(body.players) ||
      body.players.length < 1 ||
      body.players.length > 8) {
    return {
      code: 'INVALID_PLAYERS',
      message: 'players must contain 1 to 8 players'
    };
  }

  // 참가자별 검사
  for (const player of body.players) {
    if (!player || typeof player !== 'object' ||
        Array.isArray(player)) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'Invalid player data'
      };
    }

    // 닉네임 검사
    if (typeof player.nickname !== 'string' ||
        player.nickname.trim().length === 0 ||
        [...player.nickname].length > 10) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'nickname must be 1 to 10 characters'
      };
    }

    // 순위는 양의 정수
    if (!Number.isInteger(player.rank) || player.rank < 1) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'Invalid player rank'
      };
    }

    // 총자산은 0 이상 정수
    if (!Number.isSafeInteger(player.totalAsset) ||
        player.totalAsset < 0) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'totalAsset must be a non-negative integer'
      };
    }

    // 수익률은 소수점 첫째 자리까지
    if (typeof player.returnPct !== 'number' ||
        !Number.isFinite(player.returnPct) ||
        Math.abs(player.returnPct) > 99999.9 ||
        Math.abs(player.returnPct * 10 -
          Math.round(player.returnPct * 10)) > 1e-8) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'Invalid returnPct'
      };
    }

    // 루머 사용 횟수 검사 (생략 시 0)
    const rumorsUsed = player.rumorsUsed ?? 0;
    if (!Number.isInteger(rumorsUsed) ||
        rumorsUsed < 0 || rumorsUsed > 127) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'Invalid rumorsUsed'
      };
    }
  }

  // 순위가 1부터 연속되는지 확인
  const ranks = body.players
    .map(player => player.rank)
    .sort((a, b) => a - b);

  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) {
      return {
        code: 'INVALID_PLAYERS',
        message: 'Player ranks must be consecutive from 1'
      };
    }
  }

  // 문제가 없으면 null 반환
  return null;
}

module.exports = { validateResult };