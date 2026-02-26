const { Pool } = require('pg');
require('dotenv').config();

async function checkTables() {
    const pool = new Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME ?? 'postgres',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
    });

    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('Tables in database:', res.rows.map(r => r.table_name).join(', '));
    } catch (err) {
        console.error('Error checking tables:', err.message);
    } finally {
        await pool.end();
    }
}

checkTables();
