const { startAgents } = require('../src/agents');

startAgents().catch(error => {
  console.error('Failed to start agents:', error);
  process.exit(1);
});
