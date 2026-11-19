// 수익률 순위 (docs/game-design.md 6-5)
// 수익률 높은 순, 같으면 먼저 입장한 사람이 위. 게임 중 나간 사람도 순위에 남는다.
function rankPlayers(players, portfolios, prices) {
  return players
    .map((player, joinOrder) => {
      const portfolio = portfolios.get(player.playerId);
      return {
        playerId: player.playerId,
        nickname: player.nickname,
        returnPct: portfolio ? portfolio.returnPct(prices) : 0,
        totalAsset: portfolio ? portfolio.totalAsset(prices) : 0,
        joinOrder,
      };
    })
    .sort((a, b) => b.returnPct - a.returnPct || a.joinOrder - b.joinOrder)
    .map(({ joinOrder, ...entry }, i) => ({ rank: i + 1, ...entry })); // eslint-disable-line no-unused-vars
}

module.exports = { rankPlayers };
