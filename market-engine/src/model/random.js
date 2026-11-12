// 시드를 정할 수 있는 난수: 같은 시드면 항상 같은 숫자 열 (테스트 재현용)

// mulberry32: 0 이상 1 미만의 난수
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandom(seed) {
  const next = mulberry32(seed);
  let spare = null;

  return {
    next,
    // 박스-뮬러 변환: 평균 0, 표준편차 1인 정규분포 난수
    normal() {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
  };
}

// 시드를 따로 정하지 않은 방에 쓸 임의의 시드
function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32);
}

module.exports = { createRandom, randomSeed };
