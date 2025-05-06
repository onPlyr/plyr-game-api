const { getRedisClient } = require('../db/redis');

const STREAM_KEY = 'blockscoutstream';

const insertBlockScoutTask = async (params, taskName) => {
  console.log('insertBlockScoutTask to redis', params, taskName);
  const redis = getRedisClient();
  const taskId = await redis.xadd(STREAM_KEY, '*', taskName, JSON.stringify(params));
  console.log('insertBlockScoutTask to redis', taskId);
  return taskId;
}

module.exports = {
  insertBlockScoutTask,
}
