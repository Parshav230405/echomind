const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' }); // Look in parent root for .env if not found locally, or locally
require('dotenv').config(); // Local fallback

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'echomind',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection immediately to assist debugging
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Connected successfully to MySQL database: "${process.env.DB_NAME || 'echomind'}"`);
    connection.release();
  } catch (err) {
    console.error('\n==================================================================');
    console.error('[DATABASE CONNECTION ERROR]');
    console.error('Failed to establish a connection to your MySQL database.');
    console.error(`Error details: ${err.message}`);
    console.error('------------------------------------------------------------------');
    console.error('HOW TO DEBUG:');
    console.error('1. Verify your MySQL service is running locally or remotely.');
    console.error('2. Check server/.env (or root .env) contains correct DB credentials:');
    console.error(`   - DB_HOST (currently: "${process.env.DB_HOST || 'localhost'}")`);
    console.error(`   - DB_USER (currently: "${process.env.DB_USER || 'root'}")`);
    console.error(`   - DB_NAME (currently: "${process.env.DB_NAME || 'echomind'}")`);
    console.error(`   - DB_PORT (currently: "${process.env.DB_PORT || '3306'}")`);
    console.error('3. Make sure you have run the schema.sql script to create the DB.');
    console.error('==================================================================\n');
  }
})();

module.exports = pool;
