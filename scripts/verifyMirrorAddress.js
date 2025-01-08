require('dotenv').config();
const mongoose = require('mongoose');
const UserInfo = require('../src/models/userInfo');

const ENSABI = [{
  "inputs": [
    {
      "internalType": "string",
      "name": "_ensName",
      "type": "string"
    }
  ],
  "name": "getENSAddress",
  "outputs": [
    {
      "internalType": "address",
      "name": "",
      "type": "address"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}];

const ENSADDR = '0x9684c4d61A62CFc43174953B814995E412cA1096';

const { chain } = require('../src/config');
const { getRedisClient } = require('../src/db/redis');
const { getAddress, zeroAddress } = require('viem');
const redis = getRedisClient();

async function main() {
  let processedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  let create = true; // process.argv.includes('--create');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB successfully');

    // Get all users from MongoDB
    let users = await UserInfo.find({
      $or: [
        { verified: false },
        { verified: { $exists: false } }
      ]
    }, { plyrId: 1, mirror: 1, primaryAddress: 1, plyrId: 1, chainId: 1 });
    console.log(`✓ Found ${users.length} users to process`);

    users = users.reverse();

    // Process users in batches of 20
    const batchSize = 2;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const promises = batch.map(async (user) => {
        try {
          console.log('mirror', user.plyrId, user.mirror);
          let addr = await chain.readContract({ address: ENSADDR, abi: ENSABI, functionName: 'getENSAddress', args: [user.plyrId] });
          console.log('addr', addr);
          if (addr !== zeroAddress) {
            await UserInfo.updateOne({ plyrId: user.plyrId }, { verified: true });
            processedCount++;
          } else {
            console.log('❌ Not contract, Please create again!', user);
            if (!create) {
              skipCount++;
              return;
            }
            const STREAM_KEY = 'mystream';
            if (user.ippClaimed) {
              const messageId = await redis.xadd(STREAM_KEY, '*', 'createUserWithMirror', JSON.stringify({
                address: getAddress(user.primaryAddress),
                mirror: getAddress(user.mirror),
                plyrId: user.plyrId,
                chainId: user.chainId || 62831,
              }));
              console.log('Added message ID:', messageId);
            } else {
              const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
                address: getAddress(user.primaryAddress),
                plyrId: user.plyrId,
                chainId: user.chainId || 62831,
              }));
              console.log('Added message ID:', messageId);
            }
            skipCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing user ${user.plyrId}:`, error.message);
        }
      });

      // Wait for all promises in the current batch to complete
      await Promise.all(promises);

      // Log progress after each batch
      const progress = (((i + batchSize) / users.length) * 100).toFixed(2);
      console.log(`Progress: ${progress}% (${i + batchSize}/${users.length})`);
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