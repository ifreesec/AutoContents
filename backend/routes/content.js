const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createContent } = require('../services/llmService');
const { renderCover, renderDetail, OUTPUT_DIR } = require('../services/renderService');

const UPLOAD_DIR = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只能上传图片文件'));
  },
});

// 上传图片
router.post('/upload', upload.array('images', 10), (req, res) => {
  const files = req.files.map((f) => ({
    filename: f.filename,
    url: `/uploads/images/${f.filename}`,
    originalname: f.originalname,
  }));
  res.json({ success: true, data: files });
});

// 内容创作
router.post('/create', async (req, res) => {
  const { title, description, extra_info } = req.body;
  if (!title) return res.status(400).json({ success: false, error: '缺少资讯标题' });

  try {
    const result = await createContent(title, description, extra_info);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 渲染图片
router.post('/render', async (req, res) => {
  const { cover_word, cover_title, cover_description, cover_emoji, image_filenames } = req.body;

  if (!cover_word || !cover_title) {
    return res.status(400).json({ success: false, error: '缺少封面必要字段' });
  }

  const sessionId = uuidv4();

  try {
    // 渲染封面
    const coverPath = await renderCover({ cover_word, cover_title, cover_description, cover_emoji }, sessionId);

    // 渲染详情图（每张用户图片一张详情图）
    const detailPaths = [];
    const images = image_filenames || [];
    for (let i = 0; i < images.length; i++) {
      const imgPath = path.join(UPLOAD_DIR, images[i]);
      if (fs.existsSync(imgPath)) {
        const dp = await renderDetail(imgPath, sessionId, i);
        detailPaths.push(dp);
      }
    }

    const coverUrl = `/uploads/rendered/${path.basename(coverPath)}`;
    const detailUrls = detailPaths.map((p) => `/uploads/rendered/${path.basename(p)}`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        cover_url: coverUrl,
        detail_urls: detailUrls,
      },
    });
  } catch (err) {
    console.error('渲染失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
