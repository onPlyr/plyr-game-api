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

        // Check if record already exists
        const checkQuery = `
          SELECT 1 FROM address_tags
          WHERE label = $1;
        `;
        let result = await client.query(checkQuery, [name]);

        if (result.rows.length > 0) {
          console.log(`Skipping user: ${name} (already exists)`);
          return;
        }

        console.log(`Processing user: ${name} with address: ${address}`);

        // Insert new record
        let insertQuery = `
          INSERT INTO address_tags
          (label, inserted_at, updated_at, display_name)
          VALUES ($1, current_timestamp, current_timestamp, $2)
          RETURNING id;
        `;

        result = await client.query(insertQuery, [name, name]);
        const newId = result.rows[0].id;
        console.log(`✓ Successfully inserted user: ${name} with ID: ${newId}`);

        // Delete existing record if exists
        const deleteQuery = `
          DELETE FROM address_to_tags
          WHERE address_hash = decode($1, 'hex');
        `;
        await client.query(deleteQuery, [address.replace('0x', '')]);

        insertQuery = `
          INSERT INTO address_to_tags
          (address_hash, tag_id, inserted_at, updated_at)
          VALUES (decode($1, 'hex'), $2, current_timestamp, current_timestamp);
        `;

        await client.query(insertQuery, [address.replace('0x', ''), newId]);
    } catch (error) {
        console.error('Error inserting plyrId to Blockscout:', error);
    }
}

module.exports = { connectPG, closePGConnection, insertPlyrIdToBlockscout };
