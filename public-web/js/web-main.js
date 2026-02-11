const SLUGS = ['service', 'center', 'review'];
const slugLabels = {
  center: '센터소개',
  service: '서비스',
  review: '리뷰'
};

const contentEl = document.getElementById('web-content');
const navButtons = Array.from(document.querySelectorAll('.web-nav-btn'));

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setActiveNav(slug) {
  navButtons.forEach(btn => {
    if (btn.dataset.slug === slug) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function fetchPage(slug) {
  const baseUrl = window.location.origin;
  const url = new URL(`/api/web/pages/${encodeURIComponent(slug)}`, baseUrl);
  url.searchParams.set('t', Date.now().toString());
  const res = await fetch(url.toString(), {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'ngrok-skip-browser-warning': '1'
    }
  });
  if (!res.ok) {
    throw new Error(`페이지 조회 실패 (${res.status})`);
  }
  return res.json();
}

function renderBackgroundList(urls) {
  const images = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (images.length === 0) {
    return '';
  }
  const baseUrl = window.location.origin;
  return `
    <section class="web-background-section">
      <div class="web-background-list">
        ${images.map((url, idx) => `
          <figure class="web-background-item">
            <img src="${baseUrl}/${url}" alt="콘텐츠 이미지 ${idx + 1}">
          </figure>
        `).join('')}
      </div>
    </section>
  `;
}

function renderCenterPage(page) {
  const content = page.content || {};
  const highlights = Array.isArray(content.highlights) ? content.highlights : [];
  return `
    <section>
      <h1 class="web-section-title">${escapeHtml(content.title || page.title || slugLabels.center)}</h1>
      <div class="web-section-subtitle">${escapeHtml(content.subtitle || '')}</div>
      <div class="web-section-desc">${escapeHtml(content.description || '')}</div>
      <div class="web-highlight-list">
        ${highlights.map(item => `<div class="web-highlight-item">${escapeHtml(item)}</div>`).join('')}
      </div>
    </section>
  `;
}

function renderServicePage(page) {
  const content = page.content || {};
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <section>
      <h1 class="web-section-title">${escapeHtml(content.title || page.title || slugLabels.service)}</h1>
      <div class="web-section-desc">${escapeHtml(content.intro || '')}</div>
      <div class="web-card-grid">
        ${items.map(item => `
          <div class="web-card">
            <div class="web-card-title">${escapeHtml(item.title || '')}</div>
            <div class="web-card-desc">${escapeHtml(item.description || '')}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderReviewPage(page) {
  const content = page.content || {};
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <section>
      <h1 class="web-section-title">${escapeHtml(content.title || page.title || slugLabels.review)}</h1>
      <div class="web-card-grid">
        ${items.map(item => `
          <div class="web-card">
            <div class="web-stars">${'★'.repeat(Math.max(0, Math.min(5, Number(item.rating || 0))))}</div>
            <div class="web-card-desc">${escapeHtml(item.content || '')}</div>
            <div class="web-review-meta">${escapeHtml(item.name || '')}${item.date ? ` · ${escapeHtml(item.date)}` : ''}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPage(slug, page) {
  if (!contentEl) return;
  const backgroundSection = renderBackgroundList(page.content?.background_images);
  if (slug === 'center') {
    contentEl.innerHTML = renderCenterPage(page) + backgroundSection;
  } else if (slug === 'service') {
    contentEl.innerHTML = renderServicePage(page) + backgroundSection;
  } else if (slug === 'review') {
    contentEl.innerHTML = renderReviewPage(page) + backgroundSection;
  } else {
    contentEl.innerHTML = '<div class="web-loading">페이지를 찾을 수 없습니다.</div>';
  }
}

async function loadPage(slug) {
  if (!contentEl) return;
  const safeSlug = SLUGS.includes(slug) ? slug : 'center';
  setActiveNav(safeSlug);
  contentEl.innerHTML = '<div class="web-loading">로딩 중...</div>';
  try {
    const page = await fetchPage(safeSlug);
    renderPage(safeSlug, page);
  } catch (error) {
    console.error('[Web] 페이지 로드 실패:', error);
    contentEl.innerHTML = '<div class="web-loading">콘텐츠를 불러올 수 없습니다.</div>';
  }
}

function getSlugFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  if (SLUGS.includes(hash)) return hash;
  return 'service';
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const slug = btn.dataset.slug;
    if (!slug) return;
    window.location.hash = slug;
  });
});

window.addEventListener('hashchange', () => {
  loadPage(getSlugFromHash());
});

loadPage(getSlugFromHash());
