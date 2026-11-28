const express = require('express');

const healthRouter = require('./routes/health');
const resultsRouter = require('./routes/results');
const stocksRouter = require('./routes/stocks');
const hallOfFameRouter = require('./routes/hallOfFame');

const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/results', resultsRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/hall-of-fame', hallOfFameRouter);

module.exports = app;
