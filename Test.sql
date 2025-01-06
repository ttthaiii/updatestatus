DROP DATABASE IF EXISTS my_database;
CREATE DATABASE IF NOT EXISTS my_database;
USE my_database;

-- ตารางโครงการ
CREATE TABLE sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตารางผู้ใช้
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    job_position ENUM('BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM') NULL,
    site_id INT,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);
