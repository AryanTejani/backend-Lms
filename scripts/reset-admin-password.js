const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetAdminPassword() {
    const pool = new Pool({
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME ?? 'postgres',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
    });

    const email = 'admin@vidyasetu.in';
    const newPassword = 'Admin@123456'; // 12 chars min

    try {
        const hash = await bcrypt.hash(newPassword, 12);
        const result = await pool.query(
            `UPDATE staff SET password_hash = $1 WHERE email = $2 RETURNING id, email, role`,
            [hash, email]
        );

        if (result.rows.length === 0) {
            console.log('Admin not found. Creating...');
            const { randomBytes } = require('crypto');
            const timestamp = BigInt(Date.now());
            const timestampHex = timestamp.toString(16).padStart(12, '0');
            const randomHex = randomBytes(10).toString('hex');
            const id = timestampHex.slice(0, 8) + '-' + timestampHex.slice(8, 12) + '-7' + randomHex.slice(0, 3) + '-' + ((parseInt(randomHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + randomHex.slice(4, 7) + '-' + randomHex.slice(7, 19);

            await pool.query(
                `INSERT INTO staff (id, email, password_hash, role, is_active) VALUES ($1, $2, $3, 'admin', true)`,
                [id, email, hash]
            );
            console.log('✅ Admin created!');
            console.log('   Email:    ' + email);
            console.log('   Password: ' + newPassword);
            console.log('   ID:       ' + id);
        } else {
            console.log('✅ Admin password updated!');
            console.log('   Email:    ' + result.rows[0].email);
            console.log('   Role:     ' + result.rows[0].role);
            console.log('   Password: ' + newPassword);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
