require('dotenv').config();
const mongoose = require('mongoose');
const { Pool } = require('pg');
const UserInfo = require('../src/models/userInfo');

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_URL,
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.PG_USERNAME,
  password: process.env.PG_PWD,
  ssl: {
    rejectUnauthorized: false // 对于Azure PostgreSQL，我们需要SSL连接
  }
};

console.log('PostgreSQL Config (without password):', {
  ...pgConfig,
  password: '****'
});

const pool = new Pool(pgConfig);

async function main() {
  let processedCount = 0;
  let errorCount = 0;
  const startTime = new Date();

  try {
    console.log('=== Starting data migration process ===');
    console.log(`Start time: ${startTime.toISOString()}`);

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB successfully');

    // Get all users from MongoDB
    const users = await UserInfo.find({}, { plyrId: 1, mirror: 1 });
    console.log(`✓ Found ${users.length} users to process`);

    // Connect to PostgreSQL
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✓ Connected to PostgreSQL successfully');

    // Process each user
    for (const user of users) {
      try {
        const address = user.mirror.toLowerCase();
        const name = `${user.plyrId.toLowerCase()}.plyr`;

        console.log(`Processing user: ${name} with address: ${address}`);

        // Insert into PostgreSQL with correct column names
        const query = `
          INSERT INTO ${process.env.PG_TABLE} 
          (address_hash, name, "primary", inserted_at, updated_at)
          VALUES (decode($1, 'hex'), $2, false, current_timestamp, current_timestamp)
          ON CONFLICT (address_hash) DO UPDATE 
          SET name = $2, updated_at = current_timestamp;
        `;

        await client.query(query, [address.replace('0x', ''), name]);
        processedCount++;
        
        // Log progress every 10 users
        if (processedCount % 10 === 0) {
          const progress = ((processedCount / users.length) * 100).toFixed(2);
          console.log(`Progress: ${progress}% (${processedCount}/${users.length}) - Last processed: ${name}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing user ${user.plyrId}:`, error.message);
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    console.log('\n=== Migration Summary ===');
    console.log(`✓ Total users processed: ${processedCount}`);
    console.log(`❌ Total errors: ${errorCount}`);
    console.log(`⏱ Total time: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Success rate: ${((processedCount - errorCount) / processedCount * 100).toFixed(2)}%`);
    
    // Cleanup
    console.log('\nClosing database connections...');
    client.release();
    await mongoose.disconnect();
    await pool.end();
    console.log('✓ All connections closed successfully');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();