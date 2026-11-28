const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT code, name, sector, description FROM stocks ORDER BY code'
    );

    return res.status(200).json({
      stocks: rows
    });

  } catch (error) {
    console.error('Stocks API error:', error.code);

    return res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: 'Database unavailable'
    });
  }
});

module.exports = router;