// 가격 모델 확인용 그래프 (PR 첨부용)
// 사용법: node scripts/plot-prices.js <시드> <저장할 파일.svg>
// 예:     node scripts/plot-prices.js 42 "C:\dev\Step C\price-seed42.svg"
const fs = require("fs");
const PriceModel = require("../src/model/PriceModel");
const STOCKS = require("../src/data/stocks.json");

const seed = Number(process.argv[2]);
const outPath = process.argv[3];
if (!Number.isInteger(seed) || !outPath) {
  console.log('사용법: node scripts/plot-prices.js <시드> <저장할 파일.svg>');
  process.exit(1);
}

const TICKS = 600;
const codes = Object.keys(STOCKS);
const model = new PriceModel({ codes, seed });
const history = [model.snapshot()];
for (let i = 0; i < TICKS; i++) history.push(model.step());

// 시작가 대비 등락률(%)로 그려서 종목끼리 비교
const series = codes.map((code) =>
  history.map((p) => (p[code] / STOCKS[code].startPrice - 1) * 100)
);
const maxAbs = Math.max(10, ...series.flat().map(Math.abs));
const range = Math.ceil(maxAbs / 5) * 5;

const W = 900, H = 500, L = 60, R = 170, T = 40, B = 40;
const x = (i) => L + (i / TICKS) * (W - L - R);
const y = (v) => T + ((range - v) / (2 * range)) * (H - T - B);
const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12">`;
svg += `<rect width="${W}" height="${H}" fill="white"/>`;
svg += `<text x="${L}" y="24" font-size="15" font-weight="bold">대결 모드 가격 (시드 ${seed}, 600초)</text>`;
for (let v = -range; v <= range; v += 5) {
  svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#888" : "#eee"}"/>`;
  svg += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
}
for (let s = 0; s <= TICKS; s += 100) {
  svg += `<text x="${x(s)}" y="${H - 15}" text-anchor="middle">${s}초</text>`;
}
series.forEach((values, k) => {
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  svg += `<polyline fill="none" stroke="${colors[k]}" stroke-width="1.5" points="${points}"/>`;
  const last = values[values.length - 1];
  const ly = T + 20 + k * 22;
  svg += `<line x1="${W - R + 15}" x2="${W - R + 35}" y1="${ly}" y2="${ly}" stroke="${colors[k]}" stroke-width="3"/>`;
  svg += `<text x="${W - R + 42}" y="${ly + 4}">${STOCKS[codes[k]].name} ${last >= 0 ? "+" : ""}${last.toFixed(1)}%</text>`;
});
svg += "</svg>";

fs.writeFileSync(outPath, svg);
console.log(`저장 완료: ${outPath}`);
