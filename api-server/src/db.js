const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'mockbattle',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function waitForDatabase() {
  while (true) {
    try {
      await pool.query('SELECT 1');
      console.log('MySQL connected successfully');
      return;
    } catch (error) {
      console.error('MySQL connection failed:', error.code);
      console.log('Retrying in 3 seconds...');

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

module.exports = { pool, waitForDatabase };