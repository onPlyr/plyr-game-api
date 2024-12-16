const { app, startServer } = require('./api/app');
const { connectDB } = require('./db/mongoose');
const { connectPG, closePGConnection } = require('./db/postgres');

async function startApp() {
  await connectDB();
  await connectPG();
  startServer();
}

startApp().catch(err => {
  console.error('Failed to start the application:', err);
  closePGConnection();
  process.exit(1);
});
