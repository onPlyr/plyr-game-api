require('dotenv').config();
const mongoose = require('mongoose');
const UserInfo = require('../src/models/userInfo');
const { chain } = require('../src/config');
const { getRedisClient } = require('../src/db/redis');
const { getAddress } = require('viem');
const redis = getRedisClient();

async function main() {
  let processedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  let create = process.argv.includes('--create');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB successfully');

    // Get all users from MongoDB
    const users = await UserInfo.find({
      $or: [
        { verified: false },
        { verified: { $exists: false } }
      ]
    }, { plyrId: 1, mirror: 1 });
    console.log(`✓ Found ${users.length} users to process`);

    // Process each user
    for (const user of users) {
      try {
        console.log('mirror', user.plyrId, user.mirror);
        let bytecode = await chain.getCode({ address: user.mirror });
        console.log('bytecode', bytecode ? bytecode.length : bytecode);

        if (bytecode) {
          await UserInfo.updateOne({ plyrId: user.plyrId }, { verified: true });
          processedCount++;
        } else {
          console.log('❌ Not contract, Please create again!', user);
          if (!create) {
            skipCount++;
            continue;
          }
          const STREAM_KEY = 'mystream';
          if (user.ippClaimed) {
            // insert message into redis stream
            const messageId = await redis.xadd(STREAM_KEY, '*', 'createUserWithMirror', JSON.stringify({
              address: getAddress(user.primaryAddress),
              mirror: getAddress(user.mirror),
              plyrId: user.plyrId,
              chainId: user.chainId || 62831,
            }));
            console.log('Added message ID:', messageId);
          } else {
            // insert message into redis stream
            const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
              address: getAddress(user.primaryAddress),
              plyrId: user.plyrId,
              chainId: user.chainId || 62831,
            }));
            console.log('Added message ID:', messageId);
          }
          skipCount++;
        }
        // Log progress every 10 users
        if ((processedCount + skipCount) % 10 === 0) {
          const progress = (((processedCount + skipCount) / users.length) * 100).toFixed(2);
          console.log(`Progress: ${progress}% (${processedCount + skipCount}/${users.length})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing user ${user.plyrId}:`, error.message);
      }
    }

    // Cleanup
    console.log('\nClosing database connections...');
    await mongoose.disconnect();
    console.log('✓ All connections closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();