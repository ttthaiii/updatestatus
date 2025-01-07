import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import submitDocumentRoutes from './src/routes/submitDocument.js';
import pool from './db.js';
import MySQLStore from 'express-mysql-session';

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const options = {
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true  // สร้างตาราง sessions อัตโนมัติ
};

const sessionStore = new MySQLStore(options);
// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// ตั้งค่า File Upload
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 50 * 1024 * 1024 // จำกัดขนาดไฟล์ที่ 50MB
    },
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set views directory
app.set('views', path.join(__dirname, 'src', 'views'));

// กำหนดโฟลเดอร์ static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/submit-document', submitDocumentRoutes);

// Login Routes
app.get('/', (req, res) => {
    res.render('login');  // ต้องมีไฟล์ login.ejs ในโฟลเดอร์ views
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const users = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length > 0) {
            const user = users[0];
            if (password === user.password) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    job_position: user.job_position
                };

                if (user.role === 'admin') {
                    res.redirect('/admin');
                } else {
                    const userSites = await pool.query(
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

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Middleware for authentication
const checkAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Admin Panel Routes
app.get('/admin', async (_, res) => {
    try {
        const sites = await pool.query('SELECT * FROM sites');
        const users = await pool.query(`
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

// Add New Site
app.post('/admin/sites/add', async (req, res) => {
    const { site_name, report_link } = req.body;

    try {
        await pool.query('INSERT INTO sites (site_name, report_link) VALUES (?, ?)', [site_name, report_link]);
        res.status(201).send('Site added successfully!');
    } catch (err) {
        console.error('❌ Error adding site:', err);
        res.status(500).send('Error adding site.');
    }
});

// Edit Site
app.post('/admin/sites/edit', async (req, res) => {
    try {
        const { id, site_name, report_link } = req.body;
        await pool.query('UPDATE sites SET site_name = ?, report_link = ? WHERE id = ?', [site_name, report_link, id]);
        res.status(200).json({ message: 'Project updated successfully' });
    } catch (err) {
        console.error('❌ Error updating site:', err);
        res.status(500).json({ error: 'Error updating site' });
    }
});

// Delete Site
app.post('/admin/sites/delete', async (req, res) => {
    const { id } = req.body;

    try {
        await pool.query('DELETE FROM sites WHERE id = ?', [id]);
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('❌ Error deleting site:', err);
        res.status(500).json({ error: 'Error deleting site' });
    }
});

app.post('/admin/add', async (req, res) => {
    const { username, password, job_position, site_ids } = req.body;
    const selectedSites = Array.isArray(site_ids) ? site_ids : [site_ids];

    try {
        // Start transaction
        await pool.query('START TRANSACTION');

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (username, password, role, job_position) VALUES (?, ?, "user", ?)',
            [username, password, job_position]
        );

        // Insert user's projects
        if (selectedSites && selectedSites.length > 0) {
            for (const siteId of selectedSites) {
                await pool.query(
                    'INSERT INTO user_projects (user_id, site_id) VALUES (?, ?)',
                    [result.insertId, siteId]
                );
            }
        }

        // Commit transaction
        await pool.query('COMMIT');
        res.redirect('/admin');
    } catch (err) {
        // Rollback on error
        await pool.query('ROLLBACK');
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
        await pool.query('START TRANSACTION');

        // Update user info
        const updateUserResult = await pool.query(
            'UPDATE users SET username = ?, password = ?, job_position = ? WHERE id = ?',
            [username, password, job_position, id]
        );

        if (updateUserResult.affectedRows === 0) {
            throw new Error('User not found');
        }

        // Remove old project associations
        await pool.query('DELETE FROM user_projects WHERE user_id = ?', [id]);

        // Add new project associations
        if (selectedSites && selectedSites.length > 0) {
            for (const siteId of selectedSites) {
                await pool.query(
                    'INSERT INTO user_projects (user_id, site_id) VALUES (?, ?)',
                    [id, siteId]
                );
            }
        }

        // Commit transaction
        await pool.query('COMMIT');
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        // Rollback on error
        await pool.query('ROLLBACK');
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
        await pool.query('START TRANSACTION');

        // Delete user's project associations
        await pool.query('DELETE FROM user_projects WHERE user_id = ?', [id]);

        // Delete user
        await pool.query('DELETE FROM users WHERE id = ?', [id]);

        // Commit transaction
        await pool.query('COMMIT');
        res.redirect('/admin');
    } catch (err) {
        // Rollback on error
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Error deleting user.');
    }
});

// Search Users
app.get('/admin/search', async (req, res) => {
    const { query: searchQuery } = req.query;

    try {
        const sites = await pool.query('SELECT * FROM sites');
        const users = await pool.query(`
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

// Menu Route
app.get('/menu', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const userSites = await pool.query(
            `SELECT s.site_name, s.report_link 
             FROM sites s 
             INNER JOIN user_projects up ON s.id = up.site_id 
             WHERE up.user_id = ? 
             ORDER BY s.site_name`,
            [userId]
        );

        res.render('menu', { 
            username: req.session.user.username, 
            job_position: req.session.user.job_position, 
            sites: userSites 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ เซิร์ฟเวอร์ทำงานที่พอร์ต ${port}`);
});