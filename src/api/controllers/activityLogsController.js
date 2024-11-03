const ActivityLog = require('../../models/activityLog');

exports.getLogs = async (ctx) => {
  const { plyrId } = ctx.params;
  let { offset, limit } = ctx.query;
  offset = parseInt(offset) || 0;
  limit = parseInt(limit) || 10;
  const logs = await ActivityLog.find({ plyrId }).sort({ timestamp: -1 }).skip(offset).limit(limit);
  ctx.body = logs;
}
