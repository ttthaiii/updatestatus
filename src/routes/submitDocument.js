import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post('/', async (req, res) => {
    // ตรวจสอบว่ามีไฟล์ถูกอัพโหลดหรือไม่
    if (!req.files || !req.files.file) {
        return res.status(400).send('กรุณาอัพโหลดไฟล์');
    }

    const { project_id, document_number, revision_number, date_of_action, status } = req.body;
    const file = req.files.file;

    try {
        // สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
        const uploadDir = path.join(__dirname, '../uploads');
        await fs.promises.mkdir(uploadDir, { recursive: true });

        // เพิ่มข้อมูลลงฐานข้อมูล
        await pool.query(
            `INSERT INTO documents (project_id, document_number, revision_number, date_of_action, status, file_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [project_id, document_number, revision_number, date_of_action, status, file.name]
        );

        // ย้ายไฟล์ไปยังโฟลเดอร์ uploads
        await file.mv(path.join(uploadDir, file.name));

        res.redirect('/menu');
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
});

export default router;