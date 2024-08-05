const config = require("../config");
const Redis = require("ioredis");

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

let step = 0;
const printStep = () => {
  console.log(step++);
};

async function checkTaskStatus(redis, streamName, groupName, messageId) {
  printStep();
  // check if the message is in the stream
  const messageInStream = await redis.xrange(streamName, messageId, messageId);
  printStep();

  if (messageInStream.length === 0) {
    console.log(
      `Message ${messageId} not found in the stream. It might have been trimmed or the stream was deleted.`
    );
    return "unknown";
  }

  printStep();
  // check if the message is pending
  const pendingInfo = await redis.xpending(
    streamName,
    groupName,
    messageId,
    messageId,
    1
  );
  printStep();

  if (pendingInfo.length > 0) {
    console.log(`Task ${messageId} is still pending or being processed.`);
    return "pending";
  }
  printStep();

  // check if the message is completed
  const completedInfo = await redis.xrange(
    `${streamName}:completed`,
    "-",
    "+",
    "COUNT",
    1,
    "STREAMS",
    `original_id`,
    messageId
  );
  printStep();

  if (completedInfo.length > 0) {
    console.log(`Task ${messageId} has been completed successfully.`);
    return "success";
  }
  printStep();

  // check if the message is failed
  const failedInfo = await redis.xrange(
    `${streamName}:deadletter`,
    "-",
    "+",
    "COUNT",
    1,
    "STREAMS",
    `original_id`,
    messageId
  );
  printStep();

  if (failedInfo.length > 0) {
    console.log(`Task ${messageId} has been failed.`);
    return "fail";
  }
  printStep();

  console.log(
    `Task ${messageId} status is uncertain. It might be in transition or there might be an issue.`
  );
  return "queued";
}

module.exports = {
  getRedisClient,
  closeRedisConnection,
  checkTaskStatus,
};
