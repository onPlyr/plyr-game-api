require('dotenv').config();
const mongoose = require('mongoose');
const UserInfo = require('../src/models/userInfo');
const { chain } = require('../src/config');

async function main() {
  let processedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

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
        console.log('mirror', user.mirror);
        let bytecode = await chain.getCode({ address: user.mirror });
        console.log('bytecode', bytecode.length);

        if (bytecode.length > 2) {
            await UserInfo.updateOne({ plyrId: user.plyrId }, { verified: true });
            processedCount++;
        } else {
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