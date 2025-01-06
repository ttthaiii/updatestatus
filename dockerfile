# ใช้ Node.js เป็นฐาน
FROM node:22

# ตั้งค่าโฟลเดอร์ทำงานใน Container
WORKDIR /usr/src/app

# คัดลอกไฟล์ package.json และ package-lock.json
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกโค้ดทั้งหมดไปยัง Container
COPY . .

# เปิดพอร์ต 3000 (หรือพอร์ตที่แอปของคุณใช้)
EXPOSE 4000

# คำสั่งรันแอป
CMD ["npm", "start"]
