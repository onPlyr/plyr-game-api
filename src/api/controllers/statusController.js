const { getRedisClient, checkTaskStatus } = require('../../db/redis');

const redis = getRedisClient();

exports.getTaskStatus = async (ctx) => {
  const STREAM_KEY = 'mystream';
  const CONSUMER_GROUP = 'mygroup';
  let ret = await checkTaskStatus(redis, STREAM_KEY, CONSUMER_GROUP, ctx.params.id);

  ctx.body = {
    status: ret
  };
};