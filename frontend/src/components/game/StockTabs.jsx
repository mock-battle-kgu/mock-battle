import { changeClass, formatChangePct, formatNumber } from '../../utils/format'

function StockTabs({ stocks, prices, basePrices, selected, onSelect }) {
  return (
    <nav aria-label="종목 선택" className="gm-tabs">
      {stocks.map((stock) => {
        const price = prices[stock.code]
        const base = basePrices[stock.code]
        const pct = price && base ? ((price - base) / base) * 100 : null
        const active = stock.code === selected
        return (
          <button
            key={stock.code}
            type="button"
            aria-pressed={active}
            className={`gm-tab ${active ? 'active' : ''}`}
            onClick={() => onSelect(stock.code)}
          >
            <span className="gm-tab-name">{stock.name}</span>
            <span className="gm-tab-price">
              <span>{formatNumber(price)}</span>
              <span className={changeClass(pct)}>{formatChangePct(pct)}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default StockTabs
