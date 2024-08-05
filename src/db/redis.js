const config = require('../config');
const Redis = require('ioredis');

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl);
  }
  return redisClient;
}

async function closeRedisConnection() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

async function checkTaskStatus(redis, streamName, groupName, messageId) {
  // check if the message is in the stream
  const messageInStream = await redis.xrange(streamName, messageId, messageId);
  
  if (messageInStream.length === 0) {
      console.log(`Message ${messageId} not found in the stream. It might have been trimmed or the stream was deleted.`);
      return 'unknown';
  }

  // check if the message is pending
  const pendingInfo = await redis.xpending(streamName, groupName, messageId, messageId, 1);
  
  if (pendingInfo.length > 0) {
      console.log(`Task ${messageId} is still pending or being processed.`);
      return 'pending';
  }

  // check if the message is completed
  const completedInfo = await redis.xrange(`${streamName}:completed`, '-', '+', 'COUNT', 1, 'STREAMS', `original_id`, messageId);
  
  if (completedInfo.length > 0) {
      console.log(`Task ${messageId} has been completed successfully.`);
      return 'success';
  }

  // check if the message is failed
  const failedInfo = await redis.xrange(`${streamName}:deadletter`, '-', '+', 'COUNT', 1, 'STREAMS', `original_id`, messageId);

  if (failedInfo.length > 0) {
      console.log(`Task ${messageId} has been failed.`);
      return 'fail';
  }

  console.log(`Task ${messageId} status is uncertain. It might be in transition or there might be an issue.`);
  return 'queued';
}

module.exports = {
  getRedisClient,
  closeRedisConnection,
  checkTaskStatus,
};
