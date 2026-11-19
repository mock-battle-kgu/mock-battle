const express = require('express');

const healthRouter = require('./routes/health');
const resultsRouter = require('./routes/results');

const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/results', resultsRouter);

module.exports = app;
