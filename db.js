import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// เพิ่มการจัดการ error
pool.getConnection()
    .then(connection => {
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
        console.log('Database connection info:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });
        connection.release();
    })
    .catch(err => {
        console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err);
        console.error('Database config:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });
    });

export default pool;