const app = require('./app');
const { waitForDatabase } = require('./db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

void waitForDatabase();