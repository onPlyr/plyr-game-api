const Task = require("../models/task");
const { getRedisClient } = require("../db/redis");
const redis = getRedisClient();

const STREAM_KEY = 'mystream';

async function checkTaskStatus(messageId) {
  const taskResult = await Task.findOne({ messageId });
  if (taskResult) {
    console.log(`Task ${messageId} status: ${taskResult.status}`);
    return taskResult.status;
  }

  const messageInStream = await redis.xrange(STREAM_KEY, messageId, messageId);
  if (messageInStream.length === 0) {
    console.log(
      `Message ${messageId} not found in the stream. It might have been trimmed or the stream was deleted.`
    );
    return "UNKNOWN";
  }

  console.log(`Task ${messageId} is still pending or being processed.`);
  return "PENDING";
}

module.exports = {
  checkTaskStatus,
};
