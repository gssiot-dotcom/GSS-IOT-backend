// middlewares/uploadImage.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 저장 디렉토리 설정 (없으면 생성)
const uploadDir = path.join(process.cwd(), 'static/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 저장 방식 정의
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 업로드 시 파일명: "타임스탬프-원본파일명"
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// 허용할 파일 타입 정의
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png format images are allowed'), false);
  }
};

// multer 인스턴스 생성 (개별 파일 최대 5MB 제한)
const uploadImage = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 개별 파일당 5MB
  fileFilter: fileFilter,
});

module.exports = uploadImage;
