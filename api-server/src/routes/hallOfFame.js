const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  // limit이 없으면 기본적으로 10개 조회
  const rawLimit = req.query.limit ?? '10';

  // limit은 1~50 사이의 정수만 허용
  if (
    typeof rawLimit !== 'string' ||
    !/^[1-9][0-9]*$/.test(rawLimit) ||
    Number(rawLimit) > 50
  ) {
    return res.status(400).json({
      code: 'INVALID_FIELD',
      message: 'limit must be between 1 and 50'
    });
  }

  const limit = Number(rawLimit);

  try {
    const [rows] = await pool.execute(
      `SELECT
         p.nickname,
         p.return_pct AS returnPct,
         g.played_at AS playedAt
       FROM game_players p
       JOIN games g ON g.id = p.game_id
       WHERE g.mode = 'battle'
       ORDER BY p.return_pct DESC, g.played_at ASC
       LIMIT ?`,
      [limit]
    );

    const result = rows.map(row => ({
      nickname: row.nickname,
      returnPct: Number(row.returnPct),
      playedAt: row.playedAt
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error('Hall of fame error:', error.code);

    const dbErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
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
      message: 'Failed to fetch hall of fame'
    });
  }
});

module.exports = router;
