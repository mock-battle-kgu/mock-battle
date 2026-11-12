// 시세 엔진에서 받은 가격을 해당 방 참가자들에게 price:tick으로 보낸다
// (C단계에서 방·게임 로직이 생기면 Game이 이 역할을 넘겨받는다)
function connectMarketToSockets({ market, io, logger }) {
  market.onTick(({ roomId, t, prices }) => {
    if (!roomId || !prices) {
      logger?.warn('tick without roomId or prices');
      return;
    }
    logger?.debug({ roomId, t }, 'tick');
    io.to(roomId).emit('price:tick', { t, prices });
  });
}

module.exports = { connectMarketToSockets };
