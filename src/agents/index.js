const config = require('../config');
const { getRedisClient } = require('../db/redis');
const { createUser, createUserWithMirror } = require('../services/user');
const Task = require('../models/task');
const { connectDB } = require('../db/mongoose');
const { claimAirdropReward } = require('../services/airdrop');
const { createWithdrawTx } = require('../services/withdraw');

const gameRoom = require('../services/game');

const redis = getRedisClient();

const STREAM_KEY = 'mystream';
const CONSUMER_GROUP = 'mygroup';
const CONSUMER_NAME = `consumer-${process.pid}`;

async function setupConsumerGroup() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
    console.log(`Consumer group ${CONSUMER_GROUP} created.`);
  } catch (err) {
    if (err.message.includes('BUSYGROUP')) {
      console.log(`Consumer group ${CONSUMER_GROUP} already exists.`);
    } else {
      throw err;
    }
  }
}

async function storeTaskResult(messageId, taskData, status, hash, errorMessage = null) {
  const taskResult = new Task({
      messageId,
      taskData,
      status,
      hash,
      errorMessage,
  });
  await taskResult.save();
  if (status !== 'FAILED') {
    await redis.xack(STREAM_KEY, CONSUMER_GROUP, messageId);
  }
  console.log(`Task result stored in MongoDB: ${JSON.stringify(taskResult)}`);
}

async function processMessage(id, message) {
  console.log(`Processing message ${id}:`, message);

  const [key, field] = message;
  const obj = JSON.parse(field);

  const maxRetries = 3;
  let retries = 0;
  let errorMessage = null;

  while (retries < maxRetries) {
    try {
      let hash;
      let result = {};
      if (key === 'createUser') {
        console.log('Creating user:', obj);
        hash = await createUser({
          primaryAddress: obj.address,
          plyrId: obj.plyrId,
          chainId: obj.chainId,
        });
      }

      if (key === 'createUserWithMirror') {
        console.log('Creating user with mirror:', obj);
        hash = await createUserWithMirror({
          primaryAddress: obj.address,
          mirror: obj.mirror,
          plyrId: obj.plyrId,
          chainId: obj.chainId,
        });
      }

      if (key === 'claimAirdropReward') {
        console.log('Claiming airdrop reward:', obj);
        hash = await claimAirdropReward(obj);
      }

      if (key === 'createWithdrawTx') {
        console.log('Creating withdraw tx:', obj);
        hash = await createWithdrawTx(obj);
      }

      if (key.includes('GameRoom')) {
        console.log('Processing game room task:', key, obj);
        let func = key.split('GameRoom')[0];
        const {hash: _hash, result: _result} = await gameRoom[func](obj);
        hash = _hash;
        result = _result;
      }

      await storeTaskResult(id, {...message, result}, 'SUCCESS', hash);
      return; // success, exit loop
    } catch (error) {
      if (error.message.includes('Transaction Receipt Failed')) {
        errorMessage = 'Transaction Receipt Failed';
        break;
      }
      retries++;
      console.error(`error: ${key} Message failed: ${retries}/${maxRetries}:`, error);
      errorMessage = error.shortMessage;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // exponential backoff
    }
  }

  await storeTaskResult(id, message, 'FAILED', null, errorMessage);
}

async function consumeMessages() {
  while (true) {
    try {
      let block = await config.chain.getBlockNumber();
      console.log('current block:', block, CONSUMER_NAME, 'Waiting for messages...');
      const ret = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'BLOCK', 30000, 'STREAMS', STREAM_KEY, '>'
      );

      if (!ret || !ret.length) {
        continue;
      }

      const [[, messages]] = ret;

      if (messages) {
        for (const [id, message] of messages) {
          await processMessage(id, message);
        }
      }
    } catch (err) {
      console.error('Error consuming messages:', err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function start() {
  await connectDB();
  await setupConsumerGroup();
  consumeMessages().catch(err => {
    console.error('Fatal error in message consumption:', err);
    process.exit(1);
  });
}

start().catch(err => {
  console.error('Failed to start message consumer:', err);
  process.exit(1);
});
