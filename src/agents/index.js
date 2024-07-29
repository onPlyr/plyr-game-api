const userActivityConsumer = require('./userActivityConsumer');
const notificationConsumer = require('./notificationConsumer');

async function startAgents() {
  await Promise.all([
    userActivityConsumer.start(),
    notificationConsumer.start()
  ]);
  console.log('All consumers started successfully');
}

module.exports = { startAgents };
