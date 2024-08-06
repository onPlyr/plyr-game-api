const { getRedisClient } = require('../../db/redis');
const { checkTaskStatus } = require('../../services/task');

const redis = getRedisClient();

exports.getTaskStatus = async (ctx) => {
  let ret = await checkTaskStatus(ctx.params.id);
  ctx.body = {
    ...ret,
  };
};
