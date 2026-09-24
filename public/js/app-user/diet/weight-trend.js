// 체중 그래프 (최근 20회 입력)

import { getRecentBodyWeightRecords } from '../api.js';

const GRAPH_ENTRY_LIMIT = 20;

let activeChart = null;

function destroyWeightTrendChart() {
    if (activeChart) {
        activeChart.destroy();
        activeChart = null;
    }
}

function formatChartDateLabel(dateKey) {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    if (parts.length >= 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateKey;
}

function formatKg(value) {
    if (!Number.isFinite(value)) return '-';
    const hasDecimal = !Number.isInteger(value);
    const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
    return `${formatted} kg`;
}

function renderChart(canvas, records) {
    destroyWeightTrendChart();
    if (!canvas || !window.Chart || records.length === 0) {
        return;
    }

    const labels = records.map(r => formatChartDateLabel(r.record_date));
    const weights = records.map(r => r.weight_kg);

    activeChart = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '체중',
                data: weights,
                borderColor: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.12)',
                borderWidth: 2,
                tension: 0.25,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#2e7d32',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatKg(ctx.parsed.y)
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 }
                },
                y: {
                    beginAtZero: false,
                    grace: '8%',
                    title: { display: false },
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}

/**
 * @param {string} appUserId
 */
export async function showBodyWeightTrendModal(appUserId) {
    destroyWeightTrendChart();

    const existingModals = document.querySelectorAll('#diet-weight-trend-modal-bg');
    existingModals.forEach(el => el.remove());

    const modalShell = `
        <div class="app-modal-bg" id="diet-weight-trend-modal-bg">
            <div class="app-modal app-modal-large workout-type-history-modal" id="diet-weight-trend-modal">
                <div class="app-modal-header">
                    <h2>체중 그래프</h2>
                    <button type="button" class="app-modal-close-btn" id="diet-weight-trend-modal-close" aria-label="닫기">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="app-modal-content workout-type-history-form workout-summary-modal-content">
                    <p class="app-text-muted" style="margin:0 0 12px;font-size:14px;">최근 ${GRAPH_ENTRY_LIMIT}회 입력 기준</p>
                    <div id="diet-weight-trend-loading" style="padding:24px;text-align:center;">불러오는 중…</div>
                    <div id="diet-weight-trend-body" style="display:none;">
                        <div class="workout-analysis-chart-wrap">
                            <canvas id="diet-weight-trend-chart"></canvas>
                        </div>
                        <ul id="diet-weight-trend-list" class="workout-analysis-session-list"></ul>
                    </div>
                    <div id="diet-weight-trend-empty" style="display:none;padding:32px;text-align:center;color:var(--app-text-muted);">
                        아직 체중 기록이 없습니다.
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalShell);

    const bg = document.getElementById('diet-weight-trend-modal-bg');
    const modal = document.getElementById('diet-weight-trend-modal');
    const closeBtn = document.getElementById('diet-weight-trend-modal-close');

    setTimeout(() => {
        bg?.classList.add('app-modal-show');
        modal?.classList.add('app-modal-show');
    }, 10);
    const loading = document.getElementById('diet-weight-trend-loading');
    const body = document.getElementById('diet-weight-trend-body');
    const empty = document.getElementById('diet-weight-trend-empty');
    const listEl = document.getElementById('diet-weight-trend-list');

    const close = () => {
        destroyWeightTrendChart();
        bg?.classList.remove('app-modal-show');
        modal?.classList.remove('app-modal-show');
        setTimeout(() => bg?.remove(), 300);
    };

    closeBtn?.addEventListener('click', close);
    bg?.addEventListener('click', (e) => {
        if (e.target === bg) close();
    });

    try {
        const records = await getRecentBodyWeightRecords(appUserId, GRAPH_ENTRY_LIMIT);
        loading.style.display = 'none';
        if (!records.length) {
            empty.style.display = 'block';
            return;
        }
        body.style.display = 'block';
        const canvas = document.getElementById('diet-weight-trend-chart');
        renderChart(canvas, records);

        if (listEl) {
            const sortedDesc = [...records].reverse();
            listEl.innerHTML = sortedDesc.map(r => {
                const dateLabel = r.record_date.replace(/-/g, '.');
                return `<li><span>${dateLabel}</span><strong>${formatKg(r.weight_kg)}</strong></li>`;
            }).join('');
        }
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.textContent = err.message || '체중 기록을 불러오지 못했습니다.';
    }
}

export { destroyWeightTrendChart };
