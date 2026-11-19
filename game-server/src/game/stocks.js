// 대결 모드 종목 (docs/protocol.md 1장)
const BATTLE_STOCKS = [
  { code: 'GANA', name: '가나전자' },
  { code: 'DARA', name: '다라항공' },
  { code: 'MABA', name: '마바게임즈' },
  { code: 'SAAH', name: '사아바이오' },
  { code: 'JACHA', name: '자차푸드' },
  { code: 'KATA', name: '카타에너지' },
];

// 연습 모드는 실제 종목을 숨기기 위해 하나의 이름만 사용
const PRACTICE_STOCKS = [{ code: 'STOCK_A', name: '???' }];

module.exports = { BATTLE_STOCKS, PRACTICE_STOCKS };
