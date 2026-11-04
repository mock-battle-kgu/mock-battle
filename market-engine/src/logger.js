// 로그는 pino 하나로 통일합니다.
const pino = require("pino");
const config = require("./config");

module.exports = pino({ name: "market-engine", level: config.logLevel });
