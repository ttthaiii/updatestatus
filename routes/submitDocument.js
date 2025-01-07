import express from 'express';
import { query } from './app.js'; // สมมติคุณมีไฟล์ db.js สำหรับจัดการฐานข้อมูล
import path from 'path';
import fileUpload from 'express-fileupload';

const router = express.Router();

// เปิดใช้งานการอัปโหลดไฟล์
router.use(fileUpload());

// 📋 แสดงฟอร์มส่งเอกสาร
router.get('/', async (req, res) => {
    try {
        if (!req.session?.user) {
            return res.redirect('/');
        }

        const userId = req.session.user.id;

        // ดึงข้อมูลโครงการที่ user มีสิทธิ์เข้าถึง
        const sites = await query(
            `SELECT s.* FROM sites s
             INNER JOIN user_projects up ON s.id = up.site_id
             WHERE up.user_id = ?
             ORDER BY s.site_name`,
            [userId]
        );

        res.render('submit-document', { sites });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error.');
    }
});

// 📥 บันทึกข้อมูลที่ผู้ใช้งานส่งเข้ามา
router.post('/', async (req, res) => {
    try {
        const { project_id, document_number, revision_number, date_of_action, status } = req.body;
        const file = req.files?.file_upload;

        if (!file) {
            return res.status(400).send('กรุณาอัปโหลดไฟล์');
        }

        // ตรวจสอบขนาดไฟล์
        if (file.size > 35 * 1024 * 1024) {
            return res.status(400).send('ไฟล์มีขนาดเกิน 35 MB.');
        }

        // บันทึกข้อมูลลงในฐานข้อมูล
        await query(
            `INSERT INTO documents (project_id, document_number, revision_number, date_of_action, status, file_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [project_id, document_number, revision_number, date_of_action, status, file.name]
        );

        // ส่งไฟล์ไปยังเซิร์ฟเวอร์
        file.mv(path.join(__dirname, '../uploads', file.name));

        res.redirect('/menu');
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
});

export default router;
