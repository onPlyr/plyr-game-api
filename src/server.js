const { app, startServer } = require('./api/app');
const { connectDB } = require('./db/mongoose');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥');
  console.error(error.name, error.message);
  console.error('Stack:', error.stack);
  console.log('Server will shut down in 3 seconds...');
  
  setTimeout(() => {
    process.kill(process.pid, 'SIGTERM');
    process.exit(1);
  }, 3000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error('Reason:', reason);
  console.log('Server will shut down in 3 seconds...');
  
  setTimeout(() => {
    process.kill(process.pid, 'SIGTERM');
    process.exit(1);
  }, 3000);
});

async function startApp() {
  await connectDB();
  startServer();
}

startApp().catch(err => {
  console.error('Failed to start the application:', err);
  process.exit(1);
});
