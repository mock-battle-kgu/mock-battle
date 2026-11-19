const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  const {
    roomId,
    mode,
    playedAt,
    durationSec,
    players
  } = req.body || {};

  // 기본 입력 확인 (상세 검증은 E단계)
  if (
    !roomId ||
    !mode ||
    !playedAt ||
    !Number.isInteger(durationSec) ||
    !Array.isArray(players) ||
    players.length === 0
  ) {
    return res.status(400).json({
      code: 'INVALID_FIELD',
      message: 'Invalid game result data'
    });
  }

  const date = new Date(playedAt);

  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({
      code: 'INVALID_FIELD',
      message: 'Invalid playedAt'
    });
  }

  // MySQL DATETIME에 UTC 기준으로 저장
  const dbPlayedAt = date.toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  let connection;

  try {
    connection = await pool.getConnection();

    // 트랜잭션 시작
    await connection.beginTransaction();

    // 1. 게임 정보 저장
    const [result] = await connection.execute(
      `INSERT INTO games
       (room_id, mode, played_at, duration_sec)
       VALUES (?, ?, ?, ?)`,
      [roomId, mode, dbPlayedAt, durationSec]
    );

    const gameId = result.insertId;

    // 2. 참가자별 결과 저장
    for (const player of players) {
      await connection.execute(
        `INSERT INTO game_players
         (game_id, nickname, rank_no, return_pct,
          total_asset, rumors_used)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          player.nickname,
          player.rank,
          player.returnPct,
          player.totalAsset,
          player.rumorsUsed ?? 0
        ]
      );
    }

    // 3. 모든 저장에 성공하면 확정
    await connection.commit();

    return res.status(201).json({ gameId });

  } catch (error) {
    // 오류 발생 시 전체 저장 취소
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error('Result save failed:', error.code);

    const dbErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'PROTOCOL_CONNECTION_LOST',
      'ER_CON_COUNT_ERROR',
      'ER_GET_CONNECTION_TIMEOUT',
      'ER_SERVER_SHUTDOWN'
    ];

    if (dbErrors.includes(error.code)) {
      return res.status(503).json({
        code: 'DB_UNAVAILABLE',
        message: 'Database unavailable'
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to save game result'
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;