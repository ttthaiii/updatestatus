import express from 'express';
import path from 'path';
import pool from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
    const { project_id, document_number, revision_number, date_of_action, status } = req.body;
    const file = req.files.file;

    try {
        // เพิ่มข้อมูลเอกสารลงในฐานข้อมูล
        await pool.query(
            `INSERT INTO documents (project_id, document_number, revision_number, date_of_action, status, file_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [project_id, document_number, revision_number, date_of_action, status, file.name]
        );

        // ย้ายไฟล์ไปยังเซิร์ฟเวอร์
        file.mv(path.join(__dirname, '../uploads', file.name));

        // เปลี่ยนเส้นทางไปยังหน้าเมนู
        res.redirect('/menu');
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
});

export default router;