const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'postgres',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
});

async function seed() {
    const sqlPath = path.join(__dirname, 'init-dummy-db.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // We only want Section 5: VidyaSetu Dummy Data
    // It starts with "-- SECTION 5: VidyaSetu Dummy Data" or the first staff insert
    const sections = sqlContent.split('-- SECTION 5: VidyaSetu Dummy Data');
    if (sections.length < 2) {
        console.error('Could not find SECTION 5 in init-dummy-db.sql');
        process.exit(1);
    }

    const dummyDataSql = sections[1];

    try {
        console.log('Connecting to database...');

        // 1. Truncate tables with CASCADE (order is important if CASCADE isn't enough, but CASCADE is powerful)
        const tablesToClear = [
            'staff', 'categories', 'tags', 'subscription_plans', 'products',
            'subscription_plan_products', 'videos', 'sections', 'lessons',
            'topics', 'quizzes', 'quiz_questions', 'quiz_question_options',
            'coupons', 'posts', 'post_categories', 'post_tags'
        ];

        console.log('Clearing existing data...');
        await pool.query(`TRUNCATE TABLE ${tablesToClear.join(', ')} CASCADE`);

        // 2. Execute the dummy data SQL
        console.log('Inserting mock data...');
        // We can execute the whole block since pg supports multiple statements in one query string
        await pool.query(dummyDataSql);

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
