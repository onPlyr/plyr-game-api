const ActivityLog = require('../models/activityLog');

async function logActivity(plyrId, gameId, type, action, data) {
  if (process.env.NODE_ENV !== 'test') {
    const activityLog = new ActivityLog({ plyrId, gameId, type, action, data });
    await activityLog.save();
  }
  console.log('Activity logged:', { plyrId, gameId, type, action, data });
}

module.exports = { logActivity };