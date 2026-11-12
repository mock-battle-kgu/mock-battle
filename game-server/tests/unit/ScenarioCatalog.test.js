const fs = require('fs');
const os = require('os');
const path = require('path');
const { ScenarioCatalog } = require('../../src/game/ScenarioCatalog');

function tempDir(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenarios-'));
  if (content !== undefined) fs.writeFileSync(path.join(dir, 'index.json'), content);
  return dir;
}

const INDEX = JSON.stringify({
  scenarios: [
    { id: 'covid-2020', file: 'covid-2020.csv', name: '삼성전자', code: '005930', period: '2020-01 ~ 2020-06', days: 120 },
    { id: 'chip-2024', file: 'chip-2024.csv', name: 'SK하이닉스', code: '000660', period: '2024-01 ~ 2024-06', days: 120 },
  ],
});

test('index.json에서 시나리오 id 목록을 읽는다', () => {
  const catalog = ScenarioCatalog.load(tempDir(INDEX));
  expect(catalog.ids()).toEqual(['covid-2020', 'chip-2024']);
});

test('reveal은 실제 종목명·코드·기간을 돌려준다', () => {
  const catalog = ScenarioCatalog.load(tempDir(INDEX));
  expect(catalog.reveal('chip-2024')).toEqual({
    scenarioId: 'chip-2024', name: 'SK하이닉스', code: '000660', period: '2024-01 ~ 2024-06',
  });
  expect(catalog.reveal('unknown')).toBeNull();
});

test('파일이 없거나 깨져 있으면 빈 목록 (서버는 계속 뜸)', () => {
  expect(ScenarioCatalog.load(tempDir()).ids()).toEqual([]);
  expect(ScenarioCatalog.load(tempDir('{broken')).ids()).toEqual([]);
});

test('저장소의 실제 scenarios/index.json을 읽을 수 있다', () => {
  const catalog = ScenarioCatalog.load(path.resolve(__dirname, '../../../scenarios'));
  expect(catalog.ids().length).toBeGreaterThan(0);
  for (const id of catalog.ids()) expect(catalog.reveal(id).name).toBeTruthy();
});
