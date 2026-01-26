// Elmo 유틸리티 함수

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

// 업로드 디렉토리 설정
const getUploadsDir = () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
};

const UPLOADS_DIR = getUploadsDir();
const ELMO_IMAGES_DIR = path.join(UPLOADS_DIR, 'elmo-images');

/**
 * Elmo 캘린더 기록 이미지 저장
 * @param {string} recordId - 기록 ID (UUID)
 * @param {Buffer} imageBuffer - 이미지 버퍼
 * @param {string} recordDate - 기록 날짜 (YYYY-MM-DD)
 * @returns {Promise<{image_url: string, image_thumbnail_url: string}>}
 */
async function saveElmoImage(recordId, imageBuffer, recordDate) {
  try {
    // 날짜별 디렉토리 구조: 2025/01/{record_id}/
    const date = new Date(recordDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const recordDir = path.join(ELMO_IMAGES_DIR, String(year), month, recordId);
    
    // 디렉토리 생성 (recursive: true로 하위 디렉토리까지 자동 생성)
    if (!fs.existsSync(recordDir)) {
      fs.mkdirSync(recordDir, { recursive: true });
    }
    
    // 원본과 썸네일을 병렬로 처리하여 성능 개선
    const originalPath = path.join(recordDir, 'original.jpg');
    const thumbnailPath = path.join(recordDir, 'thumbnail_300x300.jpg');
    
    // 두 작업을 병렬로 실행
    await Promise.all([
      // 원본 저장 (최대 800x800, JPEG 품질 65%로 최적화)
      sharp(imageBuffer)
        .rotate() // EXIF orientation 자동 적용
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ 
          quality: 65,
          progressive: true // Progressive JPEG 사용
        })
        .toFile(originalPath),
      
      // 썸네일 저장 (300x300, JPEG 품질 60%로 최적화)
      sharp(imageBuffer)
        .rotate() // EXIF orientation 자동 적용
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ 
          quality: 60,
          progressive: true
        })
        .toFile(thumbnailPath)
    ]);
    
    // 상대 경로 반환 (URL로 사용)
    const relativeDir = path.join('uploads', 'elmo-images', String(year), month, recordId);
    return {
      image_url: path.join(relativeDir, 'original.jpg').replace(/\\/g, '/'),
      image_thumbnail_url: path.join(relativeDir, 'thumbnail_300x300.jpg').replace(/\\/g, '/')
    };
  } catch (error) {
    console.error('[Elmo Calendar] 이미지 저장 오류:', error);
    throw error;
  }
}

/**
 * Elmo 이미지/동영상 업로드 설정
 */
const elmoMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'image') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
            }
        } else if (file.fieldname === 'video') {
            if (file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else {
                cb(new Error('동영상 파일만 업로드 가능합니다.'), false);
            }
        } else {
            cb(null, true);
        }
    }
});

module.exports = {
    saveElmoImage,
    elmoMediaUpload,
    ELMO_IMAGES_DIR
};
