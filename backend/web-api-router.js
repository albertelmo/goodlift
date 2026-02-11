const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const webPagesDB = require('./web-pages-db');

const webApiRouter = express.Router();

const ALLOWED_SLUGS = new Set(['center', 'service', 'review']);

const isAllowedSlug = (slug) => ALLOWED_SLUGS.has(String(slug || '').trim());

const getUploadsDir = () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
};

const UPLOADS_DIR = getUploadsDir();
const WEB_BACKGROUNDS_DIR = path.join(UPLOADS_DIR, 'web-backgrounds');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const webBackgroundUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

const saveWebBackgroundImage = async (file) => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const imageId = uuidv4();
  const dir = path.join(WEB_BACKGROUNDS_DIR, year, month);
  ensureDir(dir);
  const filename = `${imageId}.jpg`;
  const filePath = path.join(dir, filename);
  await sharp(file.buffer)
    .rotate()
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, progressive: true })
    .toFile(filePath);
  return path.join('uploads', 'web-backgrounds', year, month, filename).replace(/\\/g, '/');
};

const normalizeUploadsPath = (url) => {
  if (!url) return null;
  const cleaned = String(url).replace(/^\/+/, '');
  const withoutPrefix = cleaned.replace(/^uploads[\/\\]/, '');
  return path.join(UPLOADS_DIR, withoutPrefix);
};

webApiRouter.get('/pages', async (req, res) => {
  try {
    const includeDraft = req.query.include_draft === '1';
    const pages = await webPagesDB.listPages({ includeDraft });
    res.json({ pages });
  } catch (error) {
    console.error('[Web API] 페이지 목록 조회 오류:', error);
    res.status(500).json({ message: '페이지 목록 조회 중 오류가 발생했습니다.' });
  }
});

webApiRouter.get('/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isAllowedSlug(slug)) {
      return res.status(400).json({ message: '허용되지 않은 페이지입니다.' });
    }
    const includeDraft = req.query.include_draft === '1';
    const page = await webPagesDB.getPageBySlug(slug, { includeDraft });
    if (!page) {
      return res.status(404).json({ message: '페이지를 찾을 수 없습니다.' });
    }
    res.json(page);
  } catch (error) {
    console.error('[Web API] 페이지 조회 오류:', error);
    res.status(500).json({ message: '페이지 조회 중 오류가 발생했습니다.' });
  }
});

webApiRouter.put('/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isAllowedSlug(slug)) {
      return res.status(400).json({ message: '허용되지 않은 페이지입니다.' });
    }
    const { title, content, is_published } = req.body || {};
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ message: 'content는 객체여야 합니다.' });
    }
    const updated = await webPagesDB.upsertPage(slug, {
      title: title || slug,
      content,
      is_published
    });
    res.json(updated);
  } catch (error) {
    console.error('[Web API] 페이지 저장 오류:', error);
    res.status(500).json({ message: '페이지 저장 중 오류가 발생했습니다.' });
  }
});

// 배경 이미지 업로드 (최대 10장)
webApiRouter.post('/pages/:slug/backgrounds', webBackgroundUpload.array('images', 10), async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isAllowedSlug(slug)) {
      return res.status(400).json({ message: '허용되지 않은 페이지입니다.' });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: '업로드할 이미지가 없습니다.' });
    }
    const page = await webPagesDB.getPageBySlug(slug, { includeDraft: true });
    const content = page?.content || {};
    const currentImages = Array.isArray(content.background_images) ? content.background_images : [];
    if (currentImages.length + files.length > 10) {
      return res.status(400).json({ message: '배경 이미지는 최대 10장까지 가능합니다.' });
    }
    const savedUrls = [];
    for (const file of files) {
      const url = await saveWebBackgroundImage(file);
      savedUrls.push(url);
    }
    const updatedContent = {
      ...content,
      background_images: [...currentImages, ...savedUrls]
    };
    const updated = await webPagesDB.upsertPage(slug, {
      title: page?.title || slug,
      content: updatedContent,
      is_published: page?.is_published ?? true
    });
    res.json(updated);
  } catch (error) {
    console.error('[Web API] 배경 이미지 업로드 오류:', error);
    res.status(500).json({ message: '배경 이미지 업로드 중 오류가 발생했습니다.' });
  }
});

// 배경 이미지 삭제
webApiRouter.delete('/pages/:slug/backgrounds', async (req, res) => {
  try {
    const { slug } = req.params;
    const { url } = req.body || {};
    if (!isAllowedSlug(slug)) {
      return res.status(400).json({ message: '허용되지 않은 페이지입니다.' });
    }
    if (!url) {
      return res.status(400).json({ message: '삭제할 이미지 URL이 필요합니다.' });
    }
    const page = await webPagesDB.getPageBySlug(slug, { includeDraft: true });
    if (!page) {
      return res.status(404).json({ message: '페이지를 찾을 수 없습니다.' });
    }
    const content = page.content || {};
    const currentImages = Array.isArray(content.background_images) ? content.background_images : [];
    const nextImages = currentImages.filter(item => item !== url);
    const filePath = normalizeUploadsPath(url);
    if (filePath && filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const updated = await webPagesDB.upsertPage(slug, {
      title: page.title || slug,
      content: {
        ...content,
        background_images: nextImages
      },
      is_published: page.is_published ?? true
    });
    res.json(updated);
  } catch (error) {
    console.error('[Web API] 배경 이미지 삭제 오류:', error);
    res.status(500).json({ message: '배경 이미지 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = webApiRouter;
