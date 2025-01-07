import mysql from 'mysql2/promise';
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'your_database_name',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// เพิ่มการทดสอบการเชื่อมต่อ
pool.getConnection()
    .then(connection => {
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
        connection.release();
    })
    .catch(err => {
        console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err);
    });

export default pool;