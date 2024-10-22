const Task = require("../models/task");
const { getRedisClient } = require("../db/redis");
const redis = getRedisClient();

const STREAM_KEY = 'mystream';

async function checkTaskStatus(messageId) {
  const taskResult = await Task.findOne({ messageId });
  if (taskResult) {
    console.log(`Task ${messageId} status: ${taskResult.status}`);
    return {
      taskId: messageId,
      taskData: taskResult.taskData,
      result: taskResult.result,
      status: taskResult.status,
      hash: taskResult.hash,
      errorMessage: taskResult.errorMessage,
      completedAt: taskResult.completedAt,
    };
  }

  const messageInStream = await redis.xrange(STREAM_KEY, messageId, messageId);
  if (messageInStream.length === 0) {
    console.log(
      `Message ${messageId} not found in the stream. It might have been trimmed or the stream was deleted.`
    );
    return { status: "NOT_FOUND" };
  }

  console.log(`Task ${messageId} is still pending or being processed.`);
  return { status: "PENDING" };
}

module.exports = {
  checkTaskStatus,
};
