const { Portfolio } = require('../../src/game/Portfolio');

describe('v0.3 average fill price checks', () => {
  test('first buy sets average price', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);

    expect(portfolio.snapshot().holdings.STOCK1).toEqual({
      qty: 2,
      avgPrice: 1000,
    });
    expect(portfolio.cash).toBe(98000);
  });

  test('multiple buys calculate weighted average price', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);
    portfolio.buy('STOCK1', 3, 2000);

    expect(portfolio.snapshot().holdings.STOCK1).toEqual({
      qty: 5,
      avgPrice: 1600,
    });
  });

  test('average price is rounded to an integer', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);
    portfolio.buy('STOCK1', 1, 1001);

    expect(portfolio.snapshot().holdings.STOCK1.avgPrice).toBe(1000);
  });

  test('partial sell preserves average purchase price', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);
    portfolio.buy('STOCK1', 3, 2000);
    portfolio.sell('STOCK1', 2, 2500);

    expect(portfolio.snapshot().holdings.STOCK1).toEqual({
      qty: 3,
      avgPrice: 1600,
    });
    expect(portfolio.cash).toBe(97000);
  });

  test('selling all shares removes the holding', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);
    portfolio.sell('STOCK1', 2, 1500);

    expect(portfolio.snapshot().holdings.STOCK1).toBeUndefined();
    expect(portfolio.cash).toBe(101000);
  });

  test('different stocks maintain independent average prices', () => {
    const portfolio = new Portfolio(100000);

    portfolio.buy('STOCK1', 2, 1000);
    portfolio.buy('STOCK2', 3, 3000);
    portfolio.buy('STOCK1', 2, 2000);

    expect(portfolio.snapshot().holdings.STOCK1.avgPrice).toBe(1500);
    expect(portfolio.snapshot().holdings.STOCK2.avgPrice).toBe(3000);
  });
});
