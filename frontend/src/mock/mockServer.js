import { socket } from '../socket/socket';

export function initMockServer() {
  if (import.meta.env.VITE_MOCK !== 'true') return () => {};

  let t = 0;
  const prices = { GANA: 46000, DARA: 19000, MABA: 33000, SAAH: 71000, JACHA: 12500, KATA: 27000 };

  const interval = setInterval(() => {
    t += 1;
    socket._trigger('price:tick', { t, prices: { ...prices } });
    socket._trigger('rank:update', {
      ranks: [
        { rank: 1, nickname: '투자왕', returnPct: 15.4, totalAsset: 11540000 },
        { rank: 2, nickname: '나', returnPct: 2.1, totalAsset: 10210000 }
      ]
    });
    socket._trigger('news:push', { t, stock: 'GANA', headline: '가나, 대형 수주 임박' });
  }, 1000);

  return () => clearInterval(interval);
}
