// 요청 응답 형식 통일: 성공 { ok: true, ... } / 실패 { ok: false, code, message }
const { GameError } = require('../game/errors');

function respond(ack, work, logger) {
  if (typeof ack !== 'function') return;
  try {
    ack({ ok: true, ...work() });
  } catch (err) {
    if (err instanceof GameError) {
      ack({ ok: false, code: err.code, message: err.message });
    } else {
      logger?.error({ err: err.message }, 'request handler failed');
      ack({ ok: false, code: 'INTERNAL_ERROR', message: 'server error' });
    }
  }
}

module.exports = { respond };
