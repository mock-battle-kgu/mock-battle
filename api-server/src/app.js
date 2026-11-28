const express = require('express');

const healthRouter = require('./routes/health');
const resultsRouter = require('./routes/results');
const stocksRouter = require('./routes/stocks');

const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/results', resultsRouter);
app.use('/api/stocks', stocksRouter);

module.exports = app;
