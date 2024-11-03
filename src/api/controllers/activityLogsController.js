const ActivityLog = require('../../models/activityLog');

exports.getLogs = async (ctx) => {
  const { plyrId } = ctx.params;
  const { offset, limit } = ctx.query;
  const logs = await ActivityLog.find({ plyrId }).sort({ timestamp: -1 }).skip(offset).limit(limit);
  ctx.body = logs;
}
