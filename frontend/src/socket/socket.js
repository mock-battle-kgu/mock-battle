import { io } from 'socket.io-client';

const isMock = import.meta.env.VITE_MOCK === 'true';
const listeners = {};

export const socket = isMock 
  ? {
      connected: true,
      on: (event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      },
      off: (event, cb) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(l => l !== cb);
      },
      emit: (event, data) => {
        console.log('[Mock Socket Emit]', event, data);
      },
      _trigger: (event, data) => {
        if (listeners[event]) listeners[event].forEach(cb => cb(data));
      }
    }
  : io({
      transports: ['websocket'],
      autoConnect: true,
    });
