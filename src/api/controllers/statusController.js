const { getRedisClient } = require('../../db/redis');
const { checkTaskStatus } = require('../../services/task');

const redis = getRedisClient();

exports.getTaskStatus = async (ctx) => {
  const STREAM_KEY = 'mystream';
  const CONSUMER_GROUP = 'mygroup';
  let ret = await checkTaskStatus(ctx.params.id);

  ctx.body = {
    status: ret
  };
};
