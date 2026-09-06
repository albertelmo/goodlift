// 운동카드 → PNG 저장 (앱 UI 스타일 카드 레이아웃)

import { formatDateShort, formatWeight, formatWorkoutDuration } from '../utils.js';

const MIN_CANVAS_WIDTH = 360;
const MAX_CANVAS_WIDTH = 520;
const PADDING = 28;
const CARD_RADIUS = 8;
const CARD_PADDING = 16;
const CARD_GAP = 12;
const SECTION_GAP = 32;
const SET_ROW_HEIGHT = 26;
const SET_BADGE_SIZE = 20;
const SCALE = 2;

const COLORS = {
    bg: '#f9fafb',
    card: '#ffffff',
    cardCompleted: 'rgba(102, 126, 234, 0.08)',
    border: '#e5e7eb',
    borderCompleted: 'rgba(102, 126, 234, 0.22)',
    text: '#1f2937',
    textMuted: '#6b7280',
    primary: '#667eea',
    setBadge: 'rgba(102, 126, 234, 0.55)',
    setBadgeDone: 'rgba(107, 114, 128, 0.45)',
    pillBg: '#eef2ff',
    pillText: '#4338ca',
    shadow: 'rgba(0, 0, 0, 0.06)'
};

const FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_BOLD = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_DATE = '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_SET = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_NOTE = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_BADGE = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LINE_HEIGHT_TEXT = 18;
const LINE_HEIGHT_NAME = 17;
const LINE_HEIGHT_NOTE = 16;
const LINE_HEIGHT_TIME = 20;

const LEVEL_LABELS = { low: '낮음', medium: '보통', high: '높음' };

function parseSets(record) {
    if (Array.isArray(record.sets)) return record.sets;
    if (typeof record.sets === 'string') {
        try {
            const parsed = JSON.parse(record.sets);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function formatVolumeKg(total) {
    if (!isFinite(total) || total <= 0) return '0kg';
    const rounded = Math.round(total * 10) / 10;
    const hasDecimal = !Number.isInteger(rounded);
    const formatted = rounded.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
    return `${formatted}kg`;
}

function calculateVolumeForRecords(records = []) {
    let total = 0;
    let hasVolume = false;
    records.forEach(record => {
        parseSets(record).forEach(set => {
            const weight = parseFloat(set.weight);
            const reps = parseFloat(set.reps);
            if (isFinite(weight) && isFinite(reps)) {
                total += weight * reps;
                hasVolume = true;
            }
        });
    });
    return { hasVolume, total };
}

function normalizeDateStr(value) {
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof value === 'string') return value.split('T')[0];
    return '';
}

function isRecordCompleted(record) {
    if (record.is_text_record) return !!record.is_completed;
    const type = record.workout_type_type;
    if (type === '시간') return !!record.is_completed;
    const sets = parseSets(record);
    if (type === '세트' && sets.length > 0) {
        return sets.every(set => set.is_completed === true);
    }
    return false;
}

function getRecordBadges(record) {
    const badges = [];
    if (record.intensity_level) {
        badges.push({
            text: `운동강도 ${LEVEL_LABELS[record.intensity_level] || record.intensity_level}`,
            bg: 'rgba(59, 130, 246, 0.12)',
            border: 'rgba(59, 130, 246, 0.25)',
            color: '#1d4ed8'
        });
    }
    if (record.fatigue_level) {
        badges.push({
            text: `피로도 ${LEVEL_LABELS[record.fatigue_level] || record.fatigue_level}`,
            bg: 'rgba(245, 158, 11, 0.15)',
            border: 'rgba(245, 158, 11, 0.35)',
            color: '#b45309'
        });
    }
    return badges;
}

function wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    const paragraphs = String(text).split('\n');
    const lines = [];

    paragraphs.forEach((paragraph, index) => {
        if (index > 0) lines.push('');
        let line = '';
        for (const char of paragraph) {
            const test = line + char;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = char;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
    });

    return lines.length ? lines : [''];
}

function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function measureTextBlock(ctx, text, maxWidth, lineHeight) {
    const lines = wrapText(ctx, text, maxWidth);
    return { lines, height: lines.length * lineHeight };
}

function buildRecordItem(record) {
    const completed = isRecordCompleted(record);
    const badges = getRecordBadges(record);
    const notes = (record.notes || '').trim();

    if (record.is_text_record) {
        return {
            kind: 'text',
            completed,
            badges,
            text: (record.text_content || '').trim() || '간편 기록'
        };
    }

    const name = record.workout_type_name || '미지정';
    const type = record.workout_type_type;

    if (type === '시간') {
        return {
            kind: 'time',
            name,
            completed,
            badges,
            duration: formatWorkoutDuration(record.duration_minutes, record.duration_seconds),
            notes
        };
    }

    if (type === '세트') {
        return {
            kind: 'sets',
            name,
            completed,
            badges,
            sets: parseSets(record).map(set => ({
                number: set.set_number,
                weight: formatWeight(set.weight),
                reps: set.reps != null ? `${set.reps}회` : '-',
                completed: !!set.is_completed
            })),
            notes
        };
    }

    return { kind: 'name', name, completed, badges, notes };
}

function buildExportLayout(records) {
    const grouped = {};
    records.forEach(record => {
        const dateStr = normalizeDateStr(record.workout_date);
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(record);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    return dates.map(dateStr => {
        const dateRecords = grouped[dateStr].slice().sort((a, b) => {
            const orderA = a.display_order ?? 999999;
            const orderB = b.display_order ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        });

        const volumeInfo = calculateVolumeForRecords(dateRecords);
        const volumeText = volumeInfo.hasVolume
            ? `전체 볼륨 : ${formatVolumeKg(volumeInfo.total)}`
            : `전체 ${dateRecords.length}건`;

        return {
            dateLabel: formatDateShort(new Date(dateStr)),
            volumeText,
            itemCount: dateRecords.length,
            items: dateRecords.map(buildRecordItem)
        };
    });
}

function measureTextWidth(ctx, text, font) {
    ctx.font = font;
    return ctx.measureText(text).width;
}

function measureItemContentWidth(ctx, item) {
    let maxW = 0;

    (item.badges || []).forEach(badge => {
        maxW = Math.max(maxW, measureTextWidth(ctx, badge.text, FONT_BADGE) + 16);
    });

    if (item.kind === 'text') {
        maxW = Math.max(maxW, measureTextWidth(ctx, item.text, FONT_BOLD));
    } else {
        maxW = Math.max(maxW, measureTextWidth(ctx, item.name, FONT_BOLD));

        if (item.kind === 'time' && item.duration) {
            const durText = `⏱ ${item.duration}`;
            maxW = Math.max(maxW, measureTextWidth(ctx, durText, FONT));
        }

        if (item.kind === 'sets' && item.sets?.length) {
            item.sets.forEach(set => {
                const setText = `${set.weight} × ${set.reps}`;
                maxW = Math.max(maxW, SET_BADGE_SIZE + 10 + measureTextWidth(ctx, setText, FONT_SET));
            });
        }

        if (item.notes) {
            maxW = Math.max(maxW, measureTextWidth(ctx, item.notes, FONT_NOTE) + 8);
        }
    }

    return maxW + CARD_PADDING * 2;
}

function resolveCanvasWidth(ctx, layout) {
    let maxW = 0;

    layout.forEach(section => {
        const dateW = measureTextWidth(ctx, section.dateLabel, FONT_DATE);
        const countText = `${section.itemCount}종목`;
        const countW = measureTextWidth(ctx, countText, FONT);
        const volumeW = measureTextWidth(ctx, section.volumeText, FONT) + 20;
        maxW = Math.max(maxW, dateW + countW + volumeW + 32);

        section.items.forEach(item => {
            maxW = Math.max(maxW, measureItemContentWidth(ctx, item));
        });
    });

    return Math.ceil(Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, maxW + PADDING * 2 + 48)));
}

function measureBadges(ctx, badges, maxWidth) {
    if (!badges.length) return { height: 0, rows: [] };

    const gap = 6;
    const rowHeight = 18;
    const rows = [[]];
    let rowWidth = 0;

    badges.forEach(badge => {
        ctx.font = FONT_BADGE;
        const w = ctx.measureText(badge.text).width + 16;
        if (rowWidth + w > maxWidth && rows[rows.length - 1].length > 0) {
            rows.push([]);
            rowWidth = 0;
        }
        rows[rows.length - 1].push({ ...badge, width: w });
        rowWidth += w + gap;
    });

    return { height: rows.length * rowHeight + (rows.length > 0 ? 8 : 0), rows, rowHeight, gap };
}

function measureCard(ctx, item, contentWidth) {
    const innerWidth = contentWidth - CARD_PADDING * 2;
    let height = CARD_PADDING;

    const badgeInfo = measureBadges(ctx, item.badges || [], innerWidth);
    height += badgeInfo.height;

    if (item.kind === 'text') {
        const textBlock = measureTextBlock(ctx, item.text, innerWidth, LINE_HEIGHT_TEXT);
        height += textBlock.height;
    } else {
        const nameBlock = measureTextBlock(ctx, item.name, innerWidth, LINE_HEIGHT_NAME);
        height += nameBlock.height + 10;

        if (item.kind === 'time' && item.duration) {
            height += LINE_HEIGHT_TIME;
        } else if (item.kind === 'sets' && item.sets?.length) {
            height += item.sets.length * SET_ROW_HEIGHT;
        }

        if (item.notes) {
            const noteBlock = measureTextBlock(ctx, item.notes, innerWidth - 8, LINE_HEIGHT_NOTE);
            height += 8 + noteBlock.height;
        }
    }

    height += CARD_PADDING;
    return Math.max(height, 48);
}

function measureLayout(ctx, layout, canvasWidth) {
    const contentWidth = canvasWidth - PADDING * 2;
    let height = PADDING;

    layout.forEach((section, index) => {
        if (index > 0) height += SECTION_GAP;

        height += 34; // date + volume 한 줄
        height += 16;

        section.items.forEach(item => {
            height += measureCard(ctx, item, contentWidth) + CARD_GAP;
        });
    });

    return height + PADDING;
}

function drawBadges(ctx, badgeInfo, x, y) {
    if (!badgeInfo.rows.length) return y;

    let currentY = y;
    badgeInfo.rows.forEach(row => {
        let currentX = x;
        row.forEach(badge => {
            roundRect(ctx, currentX, currentY, badge.width, 18, 9);
            ctx.fillStyle = badge.bg;
            ctx.fill();
            ctx.strokeStyle = badge.border;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.font = FONT_BADGE;
            ctx.fillStyle = badge.color;
            ctx.textBaseline = 'middle';
            ctx.fillText(badge.text, currentX + 8, currentY + 9);

            currentX += badge.width + badgeInfo.gap;
        });
        currentY += badgeInfo.rowHeight;
    });

    return currentY + 4;
}

function drawSetRow(ctx, set, x, y) {
    const badgeY = y + (SET_ROW_HEIGHT - SET_BADGE_SIZE) / 2;
    roundRect(ctx, x, badgeY, SET_BADGE_SIZE, SET_BADGE_SIZE, 6);
    ctx.fillStyle = set.completed ? COLORS.setBadgeDone : COLORS.setBadge;
    ctx.fill();

    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(String(set.number), x + SET_BADGE_SIZE / 2, badgeY + SET_BADGE_SIZE / 2);

    ctx.textAlign = 'left';
    ctx.font = FONT_SET;
    ctx.fillStyle = set.completed ? COLORS.textMuted : COLORS.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${set.weight} × ${set.reps}`, x + SET_BADGE_SIZE + 10, y + SET_ROW_HEIGHT / 2);
}

function drawCard(ctx, item, x, y, width) {
    const height = measureCard(ctx, item, width);
    const innerWidth = width - CARD_PADDING * 2;
    const completed = item.completed;

    ctx.save();
    roundRect(ctx, x, y, width, height, CARD_RADIUS);
    ctx.fillStyle = completed ? COLORS.cardCompleted : COLORS.card;
    ctx.fill();
    ctx.strokeStyle = completed ? COLORS.borderCompleted : COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    let cursorY = y + CARD_PADDING;
    const innerX = x + CARD_PADDING;

    const badgeInfo = measureBadges(ctx, item.badges || [], innerWidth);
    cursorY = drawBadges(ctx, badgeInfo, innerX, cursorY);

    if (item.kind === 'text') {
        ctx.font = FONT_BOLD;
        ctx.fillStyle = COLORS.text;
        ctx.textBaseline = 'top';
        wrapText(ctx, item.text, innerWidth).forEach(line => {
            ctx.fillText(line, innerX, cursorY);
            cursorY += LINE_HEIGHT_TEXT;
        });
        return height;
    }

    ctx.font = FONT_BOLD;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = 'top';
    wrapText(ctx, item.name, innerWidth).forEach(line => {
        ctx.fillText(line, innerX, cursorY);
        cursorY += LINE_HEIGHT_NAME;
    });
    cursorY += 10;

    if (item.kind === 'time' && item.duration) {
        ctx.font = FONT;
        ctx.fillStyle = COLORS.textMuted;
        ctx.fillText(`⏱ ${item.duration}`, innerX, cursorY);
        cursorY += LINE_HEIGHT_TIME;
    } else if (item.kind === 'sets' && item.sets?.length) {
        item.sets.forEach(set => {
            drawSetRow(ctx, set, innerX, cursorY);
            cursorY += SET_ROW_HEIGHT;
        });
    }

    if (item.notes) {
        cursorY += 6;
        ctx.font = FONT_NOTE;
        ctx.fillStyle = COLORS.textMuted;
        ctx.textBaseline = 'top';
        wrapText(ctx, item.notes, innerWidth - 8).forEach(line => {
            ctx.fillText(`· ${line}`, innerX + 4, cursorY);
            cursorY += LINE_HEIGHT_NOTE;
        });
    }

    return height;
}

function drawVolumePill(ctx, text, x, y) {
    ctx.font = FONT;
    const textWidth = ctx.measureText(text).width;
    const pillW = textWidth + 18;
    const pillH = 24;

    roundRect(ctx, x, y, pillW, pillH, 12);
    ctx.fillStyle = COLORS.pillBg;
    ctx.fill();

    ctx.fillStyle = COLORS.pillText;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, y + pillH / 2);

    return pillH;
}

function drawSectionHeader(ctx, section, y, contentWidth) {
    ctx.font = FONT_DATE;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(section.dateLabel, PADDING, y + 14);

    ctx.font = FONT;
    const countText = `${section.itemCount}종목`;
    const countW = ctx.measureText(countText).width;
    const volumeW = ctx.measureText(section.volumeText).width + 18;
    const pillX = PADDING + contentWidth - volumeW;
    const countX = pillX - countW - 12;

    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(countText, countX, y + 14);
    drawVolumePill(ctx, section.volumeText, pillX, y + 2);

    return y + 34 + 16;
}

function drawLayout(ctx, layout, canvasWidth) {
    const contentWidth = canvasWidth - PADDING * 2;
    let y = PADDING;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvasWidth, ctx.canvas.height / SCALE);

    layout.forEach((section, index) => {
        if (index > 0) y += SECTION_GAP;
        y = drawSectionHeader(ctx, section, y, contentWidth);

        section.items.forEach(item => {
            const cardH = drawCard(ctx, item, PADDING, y, contentWidth);
            y += cardH + CARD_GAP;
        });
    });
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
                return;
            }
            try {
                const dataUrl = canvas.toDataURL('image/png');
                fetch(dataUrl)
                    .then(res => res.blob())
                    .then(resolve)
                    .catch(reject);
            } catch (error) {
                reject(new Error('이미지 생성 실패'));
            }
        }, 'image/png');
    });
}

function showImagePreviewModal(blob) {
    const existing = document.getElementById('workout-save-image-preview-bg');
    if (existing) existing.remove();

    const url = URL.createObjectURL(blob);
    const modalBg = document.createElement('div');
    modalBg.id = 'workout-save-image-preview-bg';
    modalBg.className = 'app-modal-bg app-modal-show';
    modalBg.innerHTML = `
        <div class="app-modal app-modal-show" id="workout-save-image-preview-modal">
            <div class="app-modal-header">
                <h3>이미지 저장</h3>
                <button class="app-modal-close-btn" id="workout-save-image-preview-close" type="button" aria-label="닫기">×</button>
            </div>
            <div class="app-modal-content" style="text-align:center;">
                <p style="margin:0 0 12px;color:#666;font-size:14px;">아래 이미지를 길게 눌러 「사진 저장」을 선택하세요.</p>
                <img src="${url}" alt="운동기록" style="max-width:100%;height:auto;border-radius:8px;">
            </div>
        </div>
    `;

    const close = () => {
        modalBg.remove();
        URL.revokeObjectURL(url);
    };

    modalBg.querySelector('#workout-save-image-preview-close').addEventListener('click', close);
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) close();
    });

    document.body.appendChild(modalBg);
}

async function saveImageBlob(blob, filename) {
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.share) {
        try {
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: filename });
                return;
            }
        } catch (error) {
            if (error?.name === 'AbortError') throw error;
        }
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
        showImagePreviewModal(blob);
        return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * 운동기록 목록을 PNG로 저장
 * @param {Array} records
 */
export async function saveWorkoutRecordsAsImage(records) {
    const safeRecords = Array.isArray(records) ? records.filter(r => r && !r.is_session_placeholder) : [];
    if (safeRecords.length === 0) {
        throw new Error('저장할 운동기록이 없습니다.');
    }

    const layout = buildExportLayout(safeRecords);
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = MAX_CANVAS_WIDTH;
    const measureCtx = measureCanvas.getContext('2d');
    const canvasWidth = resolveCanvasWidth(measureCtx, layout);
    const contentHeight = measureLayout(measureCtx, layout, canvasWidth);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * SCALE;
    canvas.height = contentHeight * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    drawLayout(ctx, layout, canvasWidth);

    const firstDate = normalizeDateStr(safeRecords[0].workout_date) || 'workout';
    const blob = await canvasToBlob(canvas);
    await saveImageBlob(blob, `workout-${firstDate}.png`);
}
