const config = require('../config');
const { getRedisClient } = require('../db/redis');
const { createUser } = require('../services/user');

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

async function handleFailedMessage(id, message) {
  const deadLetterStream = STREAM_KEY + ':deadletter';
  await redis.xadd(deadLetterStream, '*', 'original_id', id, 'data', JSON.stringify(message));
  console.error(`Message ${id} failed 3 times, move to deadletter`);
  await redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
}

async function handleSuccessMessage(id, message) {
  const successStream = STREAM_KEY + ':completed';
  await redis.xadd(successStream, '*', 'original_id', id, 'data', JSON.stringify(message));
  console.log(`Message ${id} processed successfully`);
  await redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
}

async function processMessage(id, message) {
  console.log(`Processing message ${id}:`, message);

  const [key, field] = message;
  const obj = JSON.parse(field);

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      if (key === 'createUser') {
        console.log('Creating user:', obj);
        await createUser({
          primaryAddress: obj.address,
          plyrId: obj.plyrId,
          chainId: obj.chainId,
        });
      }
      await handleSuccessMessage(id, message);
      return; // success, exit loop
    } catch (error) {
      retries++;
      console.error(`error: ${key} Message failed: ${retries}/${maxRetries}:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // exponential backoff
    }
  }

  await handleFailedMessage(id, message);
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
