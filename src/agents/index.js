const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis(config.redisUrl);

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

async function processMessage(id, message) {
  console.log(`Processing message ${id}:`);
  console.log(JSON.stringify(message, null, 2));

  // TODO:
  //await someProcessingFunction(message);

  await redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
}

async function consumeMessages() {
  while (true) {
    try {
      let block = await config.chain.getBlockNumber();
      console.log('blockNumber:', block, 'Waiting for messages...');
      const ret = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'BLOCK', 5000, 'STREAMS', STREAM_KEY, '>'
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
