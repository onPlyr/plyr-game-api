const { app, startServer } = require('./api/app');
const { connectDB } = require('./db/mongoose');

async function startApp() {
  await connectDB();
  startServer();
}

startApp().catch(err => {
  console.error('Failed to start the application:', err);
  process.exit(1);
});