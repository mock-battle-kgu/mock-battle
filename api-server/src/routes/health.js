const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      status: 'ok'
    });
  } catch (error) {
    return res.status(503).json({
      status: 'db_down'
    });
  }
});

module.exports = router;