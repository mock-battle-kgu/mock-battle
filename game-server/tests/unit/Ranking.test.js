const { rankPlayers } = require('../../src/game/Ranking');
const { Portfolio } = require('../../src/game/Portfolio');

const players = [
  { playerId: 'p1', nickname: '방장' },
  { playerId: 'p2', nickname: '손님' },
  { playerId: 'p3', nickname: '셋째' },
];

function portfoliosWith(buys) {
  const map = new Map(players.map((p) => [p.playerId, new Portfolio(10_000_000)]));
  for (const [playerId, qty] of Object.entries(buys)) map.get(playerId).buy('GANA', qty, 10_000);
  return map;
}

test('수익률 높은 순으로 1위부터 매긴다', () => {
  const portfolios = portfoliosWith({ p2: 100, p3: 50 }); // 주가가 오르면 많이 산 사람이 1위
  const ranks = rankPlayers(players, portfolios, { GANA: 12_000 });
  expect(ranks.map((r) => [r.rank, r.playerId, r.returnPct])).toEqual([
    [1, 'p2', 2],
    [2, 'p3', 1],
    [3, 'p1', 0],
  ]);
  expect(ranks[0].totalAsset).toBe(10_200_000);
});

test('수익률이 같으면 먼저 입장한 사람이 위', () => {
  const ranks = rankPlayers(players, portfoliosWith({}), {});
  expect(ranks.map((r) => r.playerId)).toEqual(['p1', 'p2', 'p3']);
});

test('주가가 내리면 순위가 뒤집힌다', () => {
  const portfolios = portfoliosWith({ p2: 100 });
  const ranks = rankPlayers(players, portfolios, { GANA: 9_000 });
  expect(ranks.map((r) => r.playerId)).toEqual(['p1', 'p3', 'p2']);
  expect(ranks[2].returnPct).toBe(-1);
});
