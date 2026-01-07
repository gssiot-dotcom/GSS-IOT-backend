// imageUploader.js
const uploadImage = require('../middlewares/uploadImage');
const multer = require('multer');

const ImageUploader = async (req, res) => {
  try {
    // 'images' 필드로 최대 30장 업로드
    uploadImage.array('images', 30)(req, res, err => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message, code: err.code });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      // 저장된 파일명 배열
      const filenames = req.files.map(file => file.filename);

      // 접근 가능한 URL 배열 (static/images 서빙한다고 가정)
      const imageUrls = filenames.map(name => `/static/images/${name}`);

      return res.json({
        count: req.files.length,
        urls: imageUrls,
      });
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { ImageUploader };
