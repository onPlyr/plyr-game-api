const { Pool } = require('pg');

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
  
const pool = new Pool(pgConfig);

let client;

async function connectPG() {
    // Connect to PostgreSQL
    console.log('Connecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✓ Connected to PostgreSQL successfully');
}

async function closePGConnection() {
    // Close the PostgreSQL connection
    console.log('Closing PostgreSQL connection...');
    await client.release();
    console.log('✓ PostgreSQL connection closed');
}

async function insertPlyrIdToBlockscout(_plyrId, _address) {
    try {
        const address = _address.toLowerCase();
        const name = `${_plyrId.toLowerCase()}.plyr`;
    
        console.log(`Blockscout DB Processing user: ${name} with address: ${address}`);
    
        // Delete existing record if exists
        // const deleteQuery = `
        //   DELETE FROM ${process.env.PG_TABLE} 
        //   WHERE address_hash = decode($1, 'hex');
        // `;
        // await client.query(deleteQuery, [address.replace('0x', '')]);

        // Insert new record
        const insertQuery = `
          INSERT INTO ${process.env.PG_TABLE} 
          (address_hash, name, "primary", inserted_at, updated_at)
          VALUES (decode($1, 'hex'), $2, false, current_timestamp, current_timestamp);
        `;
    
        await client.query(insertQuery, [address.replace('0x', ''), name]);
    } catch (error) {
        console.error('Error inserting plyrId to Blockscout:', error);
    }
}

module.exports = { connectPG, closePGConnection, insertPlyrIdToBlockscout };
