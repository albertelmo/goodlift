export const web = {
  render
};

const DEFAULT_CONTENT = {
  center: {
    title: '센터소개',
    subtitle: '',
    description: '',
    highlights: [],
    background_images: []
  },
  service: {
    title: '서비스',
    intro: '',
    items: [],
    background_images: []
  },
  review: {
    title: '리뷰',
    items: [],
    background_images: []
  }
};

let currentSlug = 'center';
let currentData = null;
let currentCenters = [];
let currentCenterName = '';

function render(container) {
  if (!container) return;
  container.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-top:0;margin-bottom:12px;color:#1976d2;font-size:1.1rem;">🌐 웹 콘텐츠</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="web-admin-tab-btn" data-slug="service">서비스</button>
        <button class="web-admin-tab-btn" data-slug="center">센터소개</button>
        <button class="web-admin-tab-btn" data-slug="review">리뷰</button>
      </div>
      <div id="web-admin-editor" style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button id="web-admin-save-btn" style="background:#1976d2;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:0.85rem;">저장</button>
        <a id="web-admin-preview-btn" href="/web#center" target="_blank" rel="noopener" style="text-decoration:none;background:#fff;color:#1976d2;border:1px solid #1976d2;padding:6px 16px;border-radius:4px;font-size:0.85rem;">미리보기</a>
        <span id="web-admin-result" style="font-size:0.85rem;color:#666;"></span>
      </div>
    </div>
  `;

  const tabButtons = Array.from(container.querySelectorAll('.web-admin-tab-btn'));
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.slug;
      if (!slug) return;
      switchTab(slug, container);
    });
  });

  const saveBtn = container.querySelector('#web-admin-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveCurrent(container));
  }

  switchTab('service', container);
}

function switchTab(slug, container) {
  const safeSlug = ['center', 'service', 'review'].includes(slug) ? slug : 'center';
  currentSlug = safeSlug;
  const tabButtons = Array.from(container.querySelectorAll('.web-admin-tab-btn'));
  tabButtons.forEach(btn => {
    if (btn.dataset.slug === safeSlug) {
      btn.style.background = '#1976d2';
      btn.style.color = '#fff';
      btn.style.border = '1px solid #1976d2';
    } else {
      btn.style.background = '#fff';
      btn.style.color = '#1976d2';
      btn.style.border = '1px solid #1976d2';
    }
  });
  const previewBtn = container.querySelector('#web-admin-preview-btn');
  if (previewBtn) {
    previewBtn.href = `/web#${safeSlug}`;
  }
  loadPage(safeSlug, container);
}

async function loadPage(slug, container) {
  const editor = container.querySelector('#web-admin-editor');
  const resultEl = container.querySelector('#web-admin-result');
  if (!editor) return;
  editor.innerHTML = '<div style="color:#777;">불러오는 중...</div>';
  if (resultEl) resultEl.textContent = '';
  try {
    const res = await fetch(`/api/web/pages/${encodeURIComponent(slug)}?include_draft=1`);
    if (!res.ok) {
      throw new Error('페이지 조회 실패');
    }
    const data = await res.json();
    currentData = data;
    if (slug === 'center') {
      await loadCenters(editor);
    } else {
      renderEditor(slug, data.content || DEFAULT_CONTENT[slug], editor);
    }
  } catch (error) {
    console.error('[Web Admin] 페이지 로드 오류:', error);
    currentData = null;
    if (slug === 'center') {
      editor.innerHTML = '<div style="color:#d32f2f;">센터 정보를 불러오지 못했습니다.</div>';
    } else {
      renderEditor(slug, DEFAULT_CONTENT[slug], editor);
    }
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '페이지를 불러오지 못했습니다.';
    }
  }
}

function renderEditor(slug, content, container) {
  const safeContent = content || DEFAULT_CONTENT[slug];
  if (slug === 'center') {
    container.innerHTML = renderCenterEditor(safeContent);
  } else if (slug === 'service') {
    container.innerHTML = renderServiceEditor(safeContent);
  } else {
    container.innerHTML = renderReviewEditor(safeContent);
  }
  const backgroundImages = Array.isArray(safeContent.background_images) ? safeContent.background_images : [];
  container.dataset.backgroundImages = JSON.stringify(backgroundImages);
  bindEditorEvents(slug, container);
}

async function loadCenters(container) {
  try {
    const res = await fetch('/api/web/centers');
    if (!res.ok) {
      throw new Error('센터 목록 조회 실패');
    }
    const data = await res.json();
    currentCenters = Array.isArray(data.centers) ? data.centers : [];
    if (currentCenters.length > 0) {
      currentCenterName = currentCenters[0].name;
    } else {
      currentCenterName = '';
    }
    renderCenterProfilesEditor(container);
  } catch (error) {
    console.error('[Web Admin] 센터 목록 조회 오류:', error);
    container.innerHTML = '<div style="color:#d32f2f;">센터 목록을 불러오지 못했습니다.</div>';
  }
}

function renderCenterProfilesEditor(container) {
  if (!container) return;
  const centerOptions = currentCenters.map(center => `
    <option value="${escapeHtmlAttr(center.name)}">${escapeHtml(center.name)}</option>
  `).join('');
  container.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <label style="font-size:0.85rem;color:#555;">센터 선택</label>
        <select id="web-center-select" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;min-width:200px;">
          ${centerOptions}
        </select>
        <span id="web-center-count" style="font-size:0.8rem;color:#777;">${currentCenters.length}개</span>
      </div>
      <div id="web-center-editor-inner"></div>
    </div>
  `;
  const select = container.querySelector('#web-center-select');
  if (select) {
    select.value = currentCenterName;
    select.addEventListener('change', () => {
      currentCenterName = select.value;
      renderSelectedCenterEditor(container);
    });
  }
  renderSelectedCenterEditor(container);
}

function renderSelectedCenterEditor(container) {
  const inner = container.querySelector('#web-center-editor-inner');
  if (!inner) return;
  const selected = currentCenters.find(center => center.name === currentCenterName) || {
    name: currentCenterName,
    title: '',
    subtitle: '',
    description: '',
    image_urls: []
  };
  inner.dataset.centerImages = JSON.stringify(selected.image_urls || []);
  inner.innerHTML = `
    ${renderCenterImagesEditor(selected.image_urls || [])}
    <label style="font-size:0.85rem;color:#555;">제목</label>
    <input id="web-center-title" value="${escapeHtmlAttr(selected.title || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
    <label style="font-size:0.85rem;color:#555;">부제목</label>
    <input id="web-center-subtitle" value="${escapeHtmlAttr(selected.subtitle || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
    <label style="font-size:0.85rem;color:#555;">설명</label>
    <textarea id="web-center-description" rows="4" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">${escapeHtml(selected.description || '')}</textarea>
  `;
}

function renderCenterImagesEditor(images = []) {
  const safeImages = Array.isArray(images) ? images : [];
  return `
    <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e0e0e0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:0.9rem;color:#333;font-weight:600;">센터 이미지 (최대 10장)</span>
        <span data-center-image-count style="font-size:0.8rem;color:#777;">${safeImages.length}/10</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
        <input id="web-center-image-input" type="file" accept="image/*" multiple style="flex:1;min-width:200px;">
        <button type="button" data-action="upload-center-image" style="border:1px solid #1976d2;background:#1976d2;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;">업로드</button>
      </div>
      <div id="web-center-image-list" style="display:grid;gap:8px;">
        ${safeImages.map((url, idx) => `
          <div style="display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fff;">
            <img src="/${url}" alt="센터 이미지 ${idx + 1}" style="width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
            <div style="flex:1;font-size:0.8rem;color:#666;word-break:break-all;">${escapeHtml(url)}</div>
            <button type="button" data-action="remove-center-image" data-url="${escapeHtmlAttr(url)}" style="border:1px solid #ddd;background:#fff;color:#333;padding:4px 10px;border-radius:4px;cursor:pointer;">삭제</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBackgroundEditorSection(backgroundImages = []) {
  const images = Array.isArray(backgroundImages) ? backgroundImages : [];
  return `
    <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e0e0e0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:0.9rem;color:#333;font-weight:600;">배경 이미지 (최대 10장)</span>
        <span data-bg-count style="font-size:0.8rem;color:#777;">${images.length}/10</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
        <input id="web-bg-input" type="file" accept="image/*" multiple style="flex:1;min-width:200px;">
        <button type="button" data-action="upload-bg" style="border:1px solid #1976d2;background:#1976d2;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;">업로드</button>
      </div>
      <div id="web-bg-list" style="display:grid;gap:8px;">
        ${images.map((url, idx) => `
          <div style="display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fff;">
            <img src="/${url}" alt="배경 이미지 ${idx + 1}" style="width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
            <div style="flex:1;font-size:0.8rem;color:#666;word-break:break-all;">${escapeHtml(url)}</div>
            <button type="button" data-action="remove-bg" data-url="${escapeHtmlAttr(url)}" style="border:1px solid #ddd;background:#fff;color:#333;padding:4px 10px;border-radius:4px;cursor:pointer;">삭제</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCenterEditor(content) {
  const highlights = Array.isArray(content.highlights) ? content.highlights : [];
  return `
    <div style="display:grid;gap:10px;">
      ${renderBackgroundEditorSection(content.background_images)}
      <label style="font-size:0.85rem;color:#555;">제목</label>
      <input id="web-center-title" value="${escapeHtmlAttr(content.title || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
      <label style="font-size:0.85rem;color:#555;">부제목</label>
      <input id="web-center-subtitle" value="${escapeHtmlAttr(content.subtitle || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
      <label style="font-size:0.85rem;color:#555;">설명</label>
      <textarea id="web-center-description" rows="4" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">${escapeHtml(content.description || '')}</textarea>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <span style="font-size:0.85rem;color:#555;">하이라이트</span>
        <button type="button" data-action="add-highlight" style="border:1px solid #1976d2;background:#fff;color:#1976d2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
      </div>
      <div id="web-center-highlights" style="display:grid;gap:6px;">
        ${highlights.map((item, idx) => `
          <div style="display:flex;gap:6px;">
            <input data-highlight-idx="${idx}" value="${escapeHtmlAttr(item)}" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <button type="button" data-action="remove-highlight" data-index="${idx}" style="border:1px solid #ddd;background:#fff;color:#333;padding:4px 8px;border-radius:4px;cursor:pointer;">삭제</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderServiceEditor(content) {
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <div style="display:grid;gap:10px;">
      ${renderBackgroundEditorSection(content.background_images)}
      <label style="font-size:0.85rem;color:#555;">제목</label>
      <input id="web-service-title" value="${escapeHtmlAttr(content.title || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
      <label style="font-size:0.85rem;color:#555;">소개 문구</label>
      <textarea id="web-service-intro" rows="3" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">${escapeHtml(content.intro || '')}</textarea>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <span style="font-size:0.85rem;color:#555;">서비스 목록</span>
        <button type="button" data-action="add-service-item" style="border:1px solid #1976d2;background:#fff;color:#1976d2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
      </div>
      <div id="web-service-items" style="display:grid;gap:8px;">
        ${items.map((item, idx) => `
          <div style="border:1px solid #eee;border-radius:6px;padding:10px;display:grid;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:#777;">서비스 ${idx + 1}</span>
              <button type="button" data-action="remove-service-item" data-index="${idx}" style="border:1px solid #ddd;background:#fff;color:#333;padding:2px 8px;border-radius:4px;cursor:pointer;">삭제</button>
            </div>
            <input data-service-title="${idx}" value="${escapeHtmlAttr(item.title || '')}" placeholder="서비스명" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <textarea data-service-desc="${idx}" rows="3" placeholder="설명" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">${escapeHtml(item.description || '')}</textarea>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderReviewEditor(content) {
  const items = Array.isArray(content.items) ? content.items : [];
  return `
    <div style="display:grid;gap:10px;">
      ${renderBackgroundEditorSection(content.background_images)}
      <label style="font-size:0.85rem;color:#555;">제목</label>
      <input id="web-review-title" value="${escapeHtmlAttr(content.title || '')}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <span style="font-size:0.85rem;color:#555;">리뷰 목록</span>
        <button type="button" data-action="add-review-item" style="border:1px solid #1976d2;background:#fff;color:#1976d2;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">추가</button>
      </div>
      <div id="web-review-items" style="display:grid;gap:8px;">
        ${items.map((item, idx) => `
          <div style="border:1px solid #eee;border-radius:6px;padding:10px;display:grid;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:#777;">리뷰 ${idx + 1}</span>
              <button type="button" data-action="remove-review-item" data-index="${idx}" style="border:1px solid #ddd;background:#fff;color:#333;padding:2px 8px;border-radius:4px;cursor:pointer;">삭제</button>
            </div>
            <input data-review-name="${idx}" value="${escapeHtmlAttr(item.name || '')}" placeholder="이름" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <textarea data-review-content="${idx}" rows="3" placeholder="리뷰 내용" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;">${escapeHtml(item.content || '')}</textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input data-review-date="${idx}" value="${escapeHtmlAttr(item.date || '')}" placeholder="날짜 (YYYY-MM-DD)" style="flex:1;min-width:140px;padding:6px;border:1px solid #ddd;border-radius:4px;">
              <input data-review-rating="${idx}" type="number" min="1" max="5" value="${escapeHtmlAttr(item.rating || 5)}" style="width:80px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function bindEditorEvents(slug, container) {
  container.onclick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionEl = target.closest('[data-action]');
    if (!actionEl || !container.contains(actionEl)) return;
    const action = actionEl.dataset.action;
    if (!action) return;
    event.preventDefault();
    if (action === 'add-highlight') {
      addCenterHighlight(container);
    } else if (action === 'remove-highlight') {
      removeItem(container, 'highlight', actionEl.dataset.index);
    } else if (action === 'add-service-item') {
      addServiceItem(container);
    } else if (action === 'remove-service-item') {
      removeItem(container, 'service', actionEl.dataset.index);
    } else if (action === 'add-review-item') {
      addReviewItem(container);
    } else if (action === 'remove-review-item') {
      removeItem(container, 'review', actionEl.dataset.index);
    } else if (action === 'upload-bg') {
      uploadBackgrounds(container);
    } else if (action === 'remove-bg') {
      removeBackground(container, actionEl.dataset.url);
    } else if (action === 'upload-center-image') {
      uploadCenterImages(container);
    } else if (action === 'remove-center-image') {
      removeCenterImage(container, actionEl.dataset.url);
    }
  };
}

function addCenterHighlight(container) {
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const content = readCenterContent(editor);
  content.highlights.push('');
  renderEditor('center', content, editor);
}

function addServiceItem(container) {
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const content = readServiceContent(editor);
  content.items.push({ title: '', description: '' });
  renderEditor('service', content, editor);
}

function addReviewItem(container) {
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const content = readReviewContent(editor);
  content.items.push({ name: '', content: '', rating: 5, date: '' });
  renderEditor('review', content, editor);
}

function removeItem(container, type, index) {
  const idx = Number(index);
  if (!Number.isFinite(idx)) return;
  const confirmed = window.confirm('삭제하시겠습니까?');
  if (!confirmed) return;
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  if (type === 'highlight') {
    const content = readCenterContent(editor);
    content.highlights.splice(idx, 1);
    renderEditor('center', content, editor);
  } else if (type === 'service') {
    const content = readServiceContent(editor);
    content.items.splice(idx, 1);
    renderEditor('service', content, editor);
  } else if (type === 'review') {
    const content = readReviewContent(editor);
    content.items.splice(idx, 1);
    renderEditor('review', content, editor);
  }
}

function getBackgroundImages(editor) {
  if (!editor) return [];
  try {
    const parsed = JSON.parse(editor.dataset.backgroundImages || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function setBackgroundImages(editor, images) {
  if (!editor) return;
  editor.dataset.backgroundImages = JSON.stringify(images || []);
  renderBackgroundList(editor, images || []);
}

function renderBackgroundList(editor, images) {
  const list = editor.querySelector('#web-bg-list');
  if (!list) return;
  list.innerHTML = (images || []).map((url, idx) => `
    <div style="display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fff;">
      <img src="/${url}" alt="배경 이미지 ${idx + 1}" style="width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
      <div style="flex:1;font-size:0.8rem;color:#666;word-break:break-all;">${escapeHtml(url)}</div>
      <button type="button" data-action="remove-bg" data-url="${escapeHtmlAttr(url)}" style="border:1px solid #ddd;background:#fff;color:#333;padding:4px 10px;border-radius:4px;cursor:pointer;">삭제</button>
    </div>
  `).join('');
  const count = editor.querySelector('[data-bg-count]');
  if (count) {
    count.textContent = `${images.length}/10`;
  }
}

async function uploadBackgrounds(container) {
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const input = editor.querySelector('#web-bg-input');
  if (!input || !input.files) return;
  const files = Array.from(input.files);
  if (files.length === 0) return;
  const existing = getBackgroundImages(editor);
  if (existing.length >= 10) {
    alert('배경 이미지는 최대 10장까지 가능합니다.');
    return;
  }
  const available = 10 - existing.length;
  const uploadFiles = files.slice(0, available);
  const formData = new FormData();
  uploadFiles.forEach(file => formData.append('images', file));
  const resultEl = container.querySelector('#web-admin-result');
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '업로드 중...';
  }
  try {
    const res = await fetch(`/api/web/pages/${encodeURIComponent(currentSlug)}/backgrounds`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      throw new Error('업로드 실패');
    }
    const updated = await res.json();
    const nextImages = Array.isArray(updated.content?.background_images)
      ? updated.content.background_images
      : existing;
    setBackgroundImages(editor, nextImages);
    input.value = '';
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '업로드 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 배경 업로드 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '업로드 실패';
    }
  }
}

async function removeBackground(container, url) {
  if (!url) return;
  const confirmed = window.confirm('배경 이미지를 삭제하시겠습니까?');
  if (!confirmed) return;
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const resultEl = container.querySelector('#web-admin-result');
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '삭제 중...';
  }
  try {
    const res = await fetch(`/api/web/pages/${encodeURIComponent(currentSlug)}/backgrounds`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      throw new Error('삭제 실패');
    }
    const updated = await res.json();
    const nextImages = Array.isArray(updated.content?.background_images)
      ? updated.content.background_images
      : getBackgroundImages(editor).filter(item => item !== url);
    setBackgroundImages(editor, nextImages);
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '삭제 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 배경 삭제 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '삭제 실패';
    }
  }
}

async function saveCurrent(container) {
  const resultEl = container.querySelector('#web-admin-result');
  const editor = container.querySelector('#web-admin-editor');
  if (!editor) return;
  let content;
  if (currentSlug === 'center') {
    await saveCenterProfile(container);
    return;
  }
  if (currentSlug === 'service') {
    content = readServiceContent(editor);
  } else {
    content = readReviewContent(editor);
  }
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '저장 중...';
  }
  try {
    const res = await fetch(`/api/web/pages/${encodeURIComponent(currentSlug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: content.title || currentSlug,
        content,
        is_published: true
      })
    });
    if (!res.ok) {
      throw new Error('저장 실패');
    }
    const data = await res.json();
    currentData = data;
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '저장 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 저장 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '저장 실패';
    }
  }
}

async function saveCenterProfile(container) {
  const resultEl = container.querySelector('#web-admin-result');
  const editor = container.querySelector('#web-admin-editor') || container;
  if (!editor) return;
  const name = currentCenterName;
  if (!name) return;
  const payload = {
    title: editor.querySelector('#web-center-title')?.value || '',
    subtitle: editor.querySelector('#web-center-subtitle')?.value || '',
    description: editor.querySelector('#web-center-description')?.value || '',
    image_urls: getCenterImagesFromState(container)
  };
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '저장 중...';
  }
  try {
    const res = await fetch(`/api/web/centers/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error('센터 저장 실패');
    }
    const updated = await res.json();
    const idx = currentCenters.findIndex(center => center.name === name);
    if (idx >= 0) {
      currentCenters[idx] = {
        ...currentCenters[idx],
        title: updated.title || '',
        subtitle: updated.subtitle || '',
        description: updated.description || '',
        image_urls: Array.isArray(updated.image_urls) ? updated.image_urls : []
      };
    }
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '저장 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 센터 저장 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '저장 실패';
    }
  }
}

function getCenterImagesFromState(container) {
  try {
    const data = container.querySelector('#web-center-editor-inner')?.dataset.centerImages || '[]';
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function setCenterImagesState(container, images) {
  const inner = container.querySelector('#web-center-editor-inner');
  if (!inner) return;
  inner.dataset.centerImages = JSON.stringify(images || []);
  renderCenterImageList(container, images || []);
}

function renderCenterImageList(container, images) {
  const list = container.querySelector('#web-center-image-list');
  if (!list) return;
  list.innerHTML = (images || []).map((url, idx) => `
    <div style="display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fff;">
      <img src="/${url}" alt="센터 이미지 ${idx + 1}" style="width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
      <div style="flex:1;font-size:0.8rem;color:#666;word-break:break-all;">${escapeHtml(url)}</div>
      <button type="button" data-action="remove-center-image" data-url="${escapeHtmlAttr(url)}" style="border:1px solid #ddd;background:#fff;color:#333;padding:4px 10px;border-radius:4px;cursor:pointer;">삭제</button>
    </div>
  `).join('');
  const count = container.querySelector('[data-center-image-count]');
  if (count) {
    count.textContent = `${images.length}/10`;
  }
}

async function uploadCenterImages(container) {
  const input = container.querySelector('#web-center-image-input');
  if (!input || !input.files) return;
  const files = Array.from(input.files);
  if (files.length === 0) return;
  const existing = getCenterImagesFromState(container);
  if (existing.length >= 10) {
    alert('센터 이미지는 최대 10장까지 가능합니다.');
    return;
  }
  const available = 10 - existing.length;
  const uploadFiles = files.slice(0, available);
  const formData = new FormData();
  uploadFiles.forEach(file => formData.append('images', file));
  const resultEl = container.querySelector('#web-admin-result');
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '업로드 중...';
  }
  try {
    const res = await fetch(`/api/web/centers/${encodeURIComponent(currentCenterName)}/images`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      throw new Error('업로드 실패');
    }
    const updated = await res.json();
    const nextImages = Array.isArray(updated.image_urls) ? updated.image_urls : existing;
    setCenterImagesState(container, nextImages);
    input.value = '';
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '업로드 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 센터 이미지 업로드 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '업로드 실패';
    }
  }
}

async function removeCenterImage(container, url) {
  if (!url) return;
  const confirmed = window.confirm('센터 이미지를 삭제하시겠습니까?');
  if (!confirmed) return;
  const resultEl = container.querySelector('#web-admin-result');
  if (resultEl) {
    resultEl.style.color = '#666';
    resultEl.textContent = '삭제 중...';
  }
  try {
    const res = await fetch(`/api/web/centers/${encodeURIComponent(currentCenterName)}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      throw new Error('삭제 실패');
    }
    const updated = await res.json();
    const nextImages = Array.isArray(updated.image_urls)
      ? updated.image_urls
      : getCenterImagesFromState(container).filter(item => item !== url);
    setCenterImagesState(container, nextImages);
    if (resultEl) {
      resultEl.style.color = '#2e7d32';
      resultEl.textContent = '삭제 완료';
    }
  } catch (error) {
    console.error('[Web Admin] 센터 이미지 삭제 오류:', error);
    if (resultEl) {
      resultEl.style.color = '#d32f2f';
      resultEl.textContent = '삭제 실패';
    }
  }
}


function readServiceContent(editor) {
  const title = editor.querySelector('#web-service-title')?.value || '';
  const intro = editor.querySelector('#web-service-intro')?.value || '';
  const titles = Array.from(editor.querySelectorAll('[data-service-title]'));
  const descs = Array.from(editor.querySelectorAll('[data-service-desc]'));
  const items = titles.map((input, idx) => ({
    title: input.value || '',
    description: descs[idx]?.value || ''
  })).filter(item => item.title.trim() !== '' || item.description.trim() !== '');
  const background_images = getBackgroundImages(editor);
  return { title, intro, items, background_images };
}

function readReviewContent(editor) {
  const title = editor.querySelector('#web-review-title')?.value || '';
  const names = Array.from(editor.querySelectorAll('[data-review-name]'));
  const contents = Array.from(editor.querySelectorAll('[data-review-content]'));
  const dates = Array.from(editor.querySelectorAll('[data-review-date]'));
  const ratings = Array.from(editor.querySelectorAll('[data-review-rating]'));
  const items = names.map((input, idx) => ({
    name: input.value || '',
    content: contents[idx]?.value || '',
    date: dates[idx]?.value || '',
    rating: Number(ratings[idx]?.value || 5)
  })).filter(item => item.name.trim() !== '' || item.content.trim() !== '');
  const background_images = getBackgroundImages(editor);
  return { title, items, background_images };
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
