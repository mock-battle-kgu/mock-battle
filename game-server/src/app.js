// Express + Socket.IO 서버를 만든다 (listen은 index.js에서, 테스트는 이 파일만 사용)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

function createApp({ logger } = {}) {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const server = http.createServer(app);
  const io = new Server(server);

  io.on('connection', (socket) => {
    logger?.info({ socketId: socket.id }, 'client connected');
    socket.on('disconnect', (reason) => {
      logger?.info({ socketId: socket.id, reason }, 'client disconnected');
    });
  });

  return { app, server, io };
}

module.exports = { createApp };
