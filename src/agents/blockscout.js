const { getRedisClient } = require('../db/redis');
const { connectPG, closePGConnection, insertPlyrIdToBlockscout } = require('../db/postgres');

const redis = getRedisClient();

const STREAM_KEY = 'blockscoutstream';
const CONSUMER_GROUP = 'blockscoutgroup';
const CONSUMER_NAME = `blockscoutconsumer-${process.pid}`;

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
  console.log(`Processing message ${id}:`, message);

  const [key, field] = message;
  const obj = JSON.parse(field);
  console.log('Inserting plyrId to blockscout', obj.plyrId, obj.mirror);
  await insertPlyrIdToBlockscout(obj.plyrId, obj.mirror);
}

async function consumeMessages() {
  while (true) {
    try {
      console.log('current time:', new Date().toISOString(), CONSUMER_NAME, 'Waiting for messages...');
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
  await connectPG();
  await setupConsumerGroup();
  consumeMessages().catch(err => {
    console.error('Fatal error in message consumption:', err);
    process.exit(1);
  });
}

start().catch(err => {
  console.error('Failed to start message consumer:', err);
  closePGConnection();
  process.exit(1);
});
