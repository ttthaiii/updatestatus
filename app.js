import express from 'express';
import mysql from 'mysql2/promise'; // ใช้ promise เพื่อรองรับ async/await
import bodyParser from 'body-parser';
import util from 'util';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import 'dotenv/config';  // โหลดค่าจากไฟล์ .env

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup View Engine
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Database Connection
const db = await mysql.createConnection(process.env.DATABASE_URL);

async function query(sql, params) {
    const [rows] = await db.execute(sql, params);
    return rows;
}
db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to the database');
});

// Express Session Setup
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Set views directory
app.set('views', path.join(__dirname, 'views'));

// Login Routes
app.get('/', (_, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const users = await query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length > 0) {
            const user = users[0];
            if (password === user.password) {
                // เพิ่ม session ตรงนี้
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    job_position: user.job_position
                };

                if (user.role === 'admin') {
                    res.redirect('/admin');
                } else {
                    // ดึงข้อมูลโครงการพร้อม report_link
                    const userSites = await query(
                        `SELECT s.* FROM sites s 
                         INNER JOIN user_projects up ON s.id = up.site_id 
                         WHERE up.user_id = ?
                         ORDER BY s.site_name`,
                        [user.id]
                    );
                    
                    res.render('menu', { 
                        username: user.username, 
                        job_position: user.job_position,
                        sites: userSites 
                    });
                }
            } else {
                res.status(401).send('Invalid username or password.');
            }
        } else {
            res.status(401).send('Invalid username or password.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});

// เพิ่ม route logout ด้วย
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// middleware สำหรับตรวจสอบ session
const checkAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Admin Panel Routes
app.get('/admin', async (_, res) => {
    try {
        const sites = await query('SELECT * FROM sites');
        const users = await query(`
            SELECT u.*, 
                   GROUP_CONCAT(up.site_id) as site_ids,
                   GROUP_CONCAT(s.site_name) as site_names
            FROM users u
            LEFT JOIN user_projects up ON u.id = up.user_id
            LEFT JOIN sites s ON up.site_id = s.id
            GROUP BY u.id
        `);

        const jobPositions = ['BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM'];
        
        res.render('admin', { 
            sites, 
            users: users.map(user => ({
                ...user,
                site_ids: user.site_ids ? user.site_ids.split(',') : [],
                site_names: user.site_names ? user.site_names.split(',') : []
            })), 
            jobPositions 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading admin panel.');
    }
});

// อัพเดทโค้ดส่วนเพิ่มโครงการ
app.post('/admin/sites/edit/:id', (req, res) => {
    const { id } = req.params;
    const { site_name, report_link } = req.body;

    const query = 'UPDATE sites SET site_name = ?, report_link = ? WHERE id = ?';
    db.query(query, [site_name, report_link, id], (err, result) => {
        if (err) {
            console.error('❌ Error updating project:', err);
            return res.status(500).send('Error updating project.');
        }
        res.status(200).send('Project updated successfully!');
    });
});

// เพิ่ม route สำหรับแก้ไขข้อมูลโครงการ
app.post('/admin/sites/edit', async (req, res) => {
    try {
        const { id, site_name, report_link } = req.body;

        if (!id || !site_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // ตรวจสอบว่าโครงการมีอยู่จริงหรือไม่
        const site = await query('SELECT * FROM sites WHERE id = ?', [id]);
        if (site.length === 0) {
            return res.status(404).json({ error: 'Site not found' });
        }

        // อัปเดตข้อมูลโครงการ
        await query(
            'UPDATE sites SET site_name = ?, report_link = ? WHERE id = ?',
            [site_name, report_link || null, id]
        );

        res.status(200).json({ 
            success: true,
            message: 'Project updated successfully',
            data: { id, site_name, report_link }
        });
    } catch (err) {
        console.error('❌ Error updating site:', err);
        res.status(500).json({ 
            error: 'Error updating site',
            details: err.message 
        });
    }
});

// Route สำหรับลบโครงการ
app.post('/admin/sites/delete', async (req, res) => {
    const { id } = req.body;

    try {
        // เริ่ม transaction
        await query('START TRANSACTION');

        // ลบข้อมูลที่เกี่ยวข้องในตาราง user_projects ก่อน
        await query('DELETE FROM user_projects WHERE site_id = ?', [id]);
        
        // จากนั้นลบข้อมูลในตาราง sites
        await query('DELETE FROM sites WHERE id = ?', [id]);

        // commit transaction
        await query('COMMIT');
        
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (err) {
        // rollback หากเกิดข้อผิดพลาด
        await query('ROLLBACK');
        console.error('Error deleting site:', err);
        res.status(500).json({ error: 'Error deleting site' });
    }
});

// Add New User
app.post('/admin/add', async (req, res) => {
    const { username, password, job_position, site_ids } = req.body;
    const selectedSites = Array.isArray(site_ids) ? site_ids : [site_ids];

    try {
        // Start transaction
        await query('START TRANSACTION');

        // Insert user
        const result = await query(
            'INSERT INTO users (username, password, role, job_position) VALUES (?, ?, "user", ?)',
            [username, password, job_position]
        );

        // Insert user's projects
        for (const siteId of selectedSites) {
            await query(
                'INSERT INTO user_projects (user_id, site_id) VALUES (?, ?)',
                [result.insertId, siteId]
            );
        }

        // Commit transaction
        await query('COMMIT');
        res.redirect('/admin');
    } catch (err) {
        // Rollback on error
        await query('ROLLBACK');
        console.error(err);
        res.status(500).send('Error adding user.');
    }
});

// Update User
app.post('/admin/edit', async (req, res) => {
    try {
        const { id, username, password, job_position, site_ids } = req.body;
        const selectedSites = Array.isArray(site_ids) ? site_ids : [site_ids];

        // Start transaction
        await query('START TRANSACTION');

        // Update user info
        const updateUserResult = await query(
            'UPDATE users SET username = ?, password = ?, job_position = ? WHERE id = ?',
            [username, password, job_position, id]
        );

        if (updateUserResult.affectedRows === 0) {
            throw new Error('User not found');
        }

        // Remove old project associations
        await query('DELETE FROM user_projects WHERE user_id = ?', [id]);

        // Add new project associations
        if (selectedSites.length > 0) {
            for (const siteId of selectedSites) {
                await query(
                    'INSERT INTO user_projects (user_id, site_id) VALUES (?, ?)',
                    [id, siteId]
                );
            }
        }

        // Commit transaction
        await query('COMMIT');
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        // Rollback on error
        await query('ROLLBACK');
        console.error('Error updating user:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Error updating user',
            details: err.message 
        });
    }
});

// Delete User
app.post('/admin/delete', async (req, res) => {
    const { id } = req.body;

    try {
        // Start transaction
        await query('START TRANSACTION');

        // Delete user's project associations
        await query('DELETE FROM user_projects WHERE user_id = ?', [id]);
        
        // Delete user
        await query('DELETE FROM users WHERE id = ?', [id]);

        // Commit transaction
        await query('COMMIT');
        res.redirect('/admin');
    } catch (err) {
        // Rollback on error
        await query('ROLLBACK');
        console.error(err);
        res.status(500).send('Error deleting user.');
    }
});

// Search Users
app.get('/admin/search', async (req, res) => {
    const { query: searchQuery } = req.query;

    try {
        const sites = await query('SELECT * FROM sites');
        const users = await query(`
            SELECT u.*, 
                   GROUP_CONCAT(up.site_id) as site_ids,
                   GROUP_CONCAT(s.site_name) as site_names
            FROM users u
            LEFT JOIN user_projects up ON u.id = up.user_id
            LEFT JOIN sites s ON up.site_id = s.id
            WHERE u.username LIKE ? OR u.job_position LIKE ?
            GROUP BY u.id
        `, [`%${searchQuery}%`, `%${searchQuery}%`]);

        const jobPositions = ['BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM'];

        res.render('admin', { 
            sites, 
            users: users.map(user => ({
                ...user,
                site_ids: user.site_ids ? user.site_ids.split(',') : [],
                site_names: user.site_names ? user.site_names.split(',') : []
            })), 
            jobPositions 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error searching users.');
    }
});

app.post('/submit-document', (req, res) => {
    const { job_position } = req.body;

    if (job_position === 'BIM') {
        // ลิงก์สำหรับ BIM
        res.redirect('https://script.google.com/macros/s/AKfycbxB8B1JEr2Aolp5tyhMnwW78phJaTcEPgINipkf3BE/dev');
    } else if (['Adminsite', 'OE', 'PE'].includes(job_position)) {
        // ลิงก์สำหรับ Adminsite, OE, PE
        res.redirect('https://script.google.com/macros/s/AKfycbzRXMZQL_YE2tPlaWhGbgfjYiRIvct36-oHJjuPB1LFlmQYAPgx2K7xVk6nGxuOm4_BFg/exec');
    } else {
        // กรณีไม่มีสิทธิ์
        res.status(403).render('error', { message: 'ไม่มีสิทธิ์เข้าถึงระบบการส่งเอกสาร' });
    }
});

app.get('/menu', async (req, res) => {
    try {
        // ตรวจสอบว่ามีการ login หรือไม่
        if (!req.session?.user) {
            return res.redirect('/');
        }

        const userId = req.session.user.id;
        
        // ดึงข้อมูลโครงการที่ user มีสิทธิ์เข้าถึง
        const userSites = await query(
            `SELECT s.site_name, s.report_link
             FROM sites s
             INNER JOIN user_projects up ON s.id = up.site_id
             WHERE up.user_id = ?
             ORDER BY s.site_name`,
            [userId]
        );
        
        // Render หน้า menu.ejs พร้อมส่งข้อมูล
        res.render('menu', { 
            username: req.session.user.username, 
            job_position: req.session.user.job_position, 
            sites: userSites 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`✅ Server is running on port ${port}`);
    
    // แสดง IP address ของเครื่อง
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const k in networkInterfaces) {
        for (const k2 of networkInterfaces[k]) {
            if (k2.family === 'IPv4' && !k2.internal) {
                addresses.push(k2.address);
            }
        }
    }
    
    console.log('Available on:');
    addresses.forEach(addr => {
        console.log(`  http://${addr}:${port}`);
    });
});