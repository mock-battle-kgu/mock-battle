// 연습 모드 시나리오 목록 (저장소의 scenarios/index.json, 시세 엔진과 같은 파일)
// 게임 서버는 시나리오를 고를 때와, 게임이 끝나고 실제 종목·기간을 공개할 때 사용한다.
const fs = require('fs');
const path = require('path');

class ScenarioCatalog {
  constructor(scenarios = []) {
    this.byId = new Map(scenarios.map((s) => [s.id, s]));
  }

  // 파일이 없거나 깨져 있어도 서버는 뜨도록 빈 목록을 돌려준다
  static load(dir, logger) {
    const file = path.join(dir, 'index.json');
    try {
      const { scenarios } = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(scenarios)) throw new Error('scenarios is not an array');
      logger?.info({ file, count: scenarios.length }, 'scenario catalog loaded');
      return new ScenarioCatalog(scenarios);
    } catch (err) {
      logger?.warn({ file, err: err.message }, 'scenario catalog not loaded');
      return new ScenarioCatalog([]);
    }
  }

  ids() {
    return [...this.byId.keys()];
  }

  // game:end의 reveal (protocol.md). 모르는 id면 null
  reveal(id) {
    const s = this.byId.get(id);
    return s ? { scenarioId: s.id, name: s.name, code: s.code, period: s.period } : null;
  }
}

module.exports = { ScenarioCatalog };
