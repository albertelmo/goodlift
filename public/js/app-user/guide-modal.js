import { escapeHtml } from './utils.js';

const MODAL_BG_ID = 'app-guide-detail-modal';
const MODAL_TITLE_ID = 'app-guide-detail-title';
const MODAL_DESC_ID = 'app-guide-detail-desc';
const MODAL_LINK_ID = 'app-guide-detail-link';
const MODAL_VIDEO_ID = 'app-guide-detail-video';
const MODAL_CLOSE_ID = 'app-guide-detail-close';

const buildExternalPreview = (rawUrl) => {
  const url = (rawUrl || '').trim();
  if (!url) return '';

  const safeUrl = escapeHtml(url);
  const lowerUrl = url.toLowerCase();
  const videoExtPattern = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    return `
      <div class="app-guide-external-preview">
        <iframe src="${embedUrl}" title="영상 미리보기" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
        <a class="app-guide-external-link" href="${safeUrl}" target="_blank" rel="noopener">전체화면 보기</a>
      </div>
    `;
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    const embedUrl = `https://player.vimeo.com/video/${videoId}`;
    return `
      <div class="app-guide-external-preview">
        <iframe src="${embedUrl}" title="영상 미리보기" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
        <a class="app-guide-external-link" href="${safeUrl}" target="_blank" rel="noopener">전체화면 보기</a>
      </div>
    `;
  }

  if (videoExtPattern.test(lowerUrl)) {
    return `
      <div class="app-guide-external-preview">
        <video controls src="${safeUrl}"></video>
        <a class="app-guide-external-link" href="${safeUrl}" target="_blank" rel="noopener">전체화면 보기</a>
      </div>
    `;
  }

  return `
    <div class="app-guide-external-preview">
      <a class="app-guide-external-link" href="${safeUrl}" target="_blank" rel="noopener">전체화면 보기</a>
    </div>
  `;
};

const ensureGuideDetailModal = () => {
  let modalBg = document.getElementById(MODAL_BG_ID);
  if (modalBg) return modalBg;

  const modalHtml = `
    <div class="app-guide-modal" id="${MODAL_BG_ID}" style="display:none;">
      <div class="app-guide-modal-content">
        <div class="app-guide-modal-header">
          <h3 id="${MODAL_TITLE_ID}">운동 가이드</h3>
          <button class="app-guide-modal-close" id="${MODAL_CLOSE_ID}">×</button>
        </div>
        <div class="app-guide-detail">
          <div class="app-guide-detail-desc" id="${MODAL_DESC_ID}"></div>
          <div class="app-guide-detail-link" id="${MODAL_LINK_ID}"></div>
          <div class="app-guide-detail-video" id="${MODAL_VIDEO_ID}"></div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modalBg = document.getElementById(MODAL_BG_ID);
  const closeBtn = document.getElementById(MODAL_CLOSE_ID);

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modalBg.style.display = 'none';
    });
  }
  modalBg.addEventListener('click', (e) => {
    if (e.target === modalBg) {
      modalBg.style.display = 'none';
    }
  });

  return modalBg;
};

export const showWorkoutGuideDetailModal = (item) => {
  if (!item) return;

  const modalBg = ensureGuideDetailModal();
  const titleEl = document.getElementById(MODAL_TITLE_ID);
  const descEl = document.getElementById(MODAL_DESC_ID);
  const linkEl = document.getElementById(MODAL_LINK_ID);
  const videoEl = document.getElementById(MODAL_VIDEO_ID);

  if (titleEl) titleEl.textContent = item.title || '운동 가이드';
  if (descEl) descEl.textContent = item.description || '';
  if (linkEl) {
    const externalLink = (item.externalLink || '').trim();
    linkEl.innerHTML = externalLink ? buildExternalPreview(externalLink) : '';
  }
  if (videoEl) {
    videoEl.innerHTML = item.videoUrl ? `<video controls src="${item.videoUrl}"></video>` : '';
  }

  modalBg.style.display = 'flex';
};
