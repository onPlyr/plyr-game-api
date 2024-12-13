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
    rejectUnauthorized: false
  }
};

console.log('PostgreSQL Config (without password):', {
  ...pgConfig,
  password: '****'
});

const pool = new Pool(pgConfig);

async function main() {
  let processedCount = 0;
  let skipCount = 0;
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

        // Check if record already exists
        const checkQuery = `
          SELECT 1 FROM ${process.env.PG_TABLE}
          WHERE encode(address_hash, 'hex') = $1;
        `;
        const result = await client.query(checkQuery, [address.replace('0x', '')]);
        
        if (result.rows.length > 0) {
          console.log(`Skipping user: ${name} (already exists)`);
          skipCount++;
          continue;
        }

        console.log(`Processing user: ${name} with address: ${address}`);

        // Insert new record
        const insertQuery = `
          INSERT INTO ${process.env.PG_TABLE} 
          (address_hash, name, "primary", inserted_at, updated_at)
          VALUES (decode($1, 'hex'), $2, false, current_timestamp, current_timestamp);
        `;

        await client.query(insertQuery, [address.replace('0x', ''), name]);
        processedCount++;
        
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

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    console.log('\n=== Migration Summary ===');
    console.log(`✓ Successfully inserted: ${processedCount}`);
    console.log(`⏭ Skipped (already exist): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏱ Total time: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Success rate: ${((processedCount + skipCount) / users.length * 100).toFixed(2)}%`);
    
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