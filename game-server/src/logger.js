// 로그를 화면(stdout)과 파일(볼륨에 연결될 logs/) 두 곳에 남긴다
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('./config');

fs.mkdirSync(config.logDir, { recursive: true });

const streams = [
  { stream: process.stdout },
  { stream: pino.destination({ dest: path.join(config.logDir, 'game-server.log'), sync: false }) },
];

module.exports = pino({ level: process.env.LOG_LEVEL || 'info' }, pino.multistream(streams));
