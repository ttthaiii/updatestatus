-- สร้างตารางโครงการ (sites)
CREATE TABLE IF NOT EXISTS sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL UNIQUE,
    report_link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้างตารางผู้ใช้ (users)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    job_position ENUM('BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM') NULL,
    site_id INT,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- สร้างตารางความสัมพันธ์ระหว่างผู้ใช้กับโครงการ (user_projects)
CREATE TABLE IF NOT EXISTS user_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    document_number VARCHAR(255) NOT NULL,
    revision_number INT NOT NULL,
    date_of_action DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (project_id) REFERENCES sites(id)
);


-- เพิ่มข้อมูลตัวอย่างในตาราง sites
INSERT INTO sites (site_name, report_link) VALUES
('Bann Sansiri Bangna', 'https://lookerstudio.google.com/s/Xtx7JPIFj'),
('DH2-พรานนก', ''),
('DH2-สาย1', '');

-- เพิ่มข้อมูลตัวอย่างในตาราง users
INSERT INTO users (username, password, role, job_position, site_id) VALUES
('thai.l', '101622', 'user', 'BIM', 1),
('krissanapol', '101485', 'user', 'Adminsite', 2),
('admin', 'admin123', 'admin', NULL, NULL);

-- เพิ่มข้อมูลตัวอย่างในตาราง user_projects
INSERT INTO user_projects (user_id, site_id) VALUES
(1, 1),  -- thai.l สามารถเข้าถึง Bann Sansiri Bangna
(2, 2),  -- krissanapol สามารถเข้าถึง DH2-พรานนก
(2, 3);  -- krissanapol สามารถเข้าถึง DH2-สาย1
