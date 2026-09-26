// 운동종목별 분석 (무게: Epley·볼륨 / 맨몸: 횟수 추이)

import { escapeHtml } from '../utils.js';

const GRAPH_SESSION_LIMIT = 20;

let activeChart = null;

export function isAnalysisEligible(isTextRecord, workoutTypeType) {
    if (isTextRecord) return false;
    if (workoutTypeType && workoutTypeType !== '세트') return false;
    return true;
}

export function estimate1RmEpley(weight, reps) {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) {
        return null;
    }
    if (r === 1) {
        return w;
    }
    return w * (1 + r / 30);
}

function parseSets(record) {
    if (Array.isArray(record.sets)) {
        return record.sets;
    }
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

function forEachEligibleSet(recordsByDate, onSet) {
    Object.keys(recordsByDate).forEach(dateKey => {
        const records = recordsByDate[dateKey] || [];
        records.forEach(record => {
            if (record.is_text_record) return;
            const type = record.workout_type_type;
            if (type && type !== '세트') return;
            parseSets(record).forEach(set => onSet(set, dateKey));
        });
    });
}

function parseSetMetrics(set) {
    const weight = parseFloat(set.weight);
    const reps = parseFloat(set.reps);
    const weightVal = Number.isFinite(weight) ? weight : 0;
    const repsVal = Number.isFinite(reps) ? reps : 0;
    return { weight: weightVal, reps: repsVal };
}

/** 무게가 한 번이라도 입력된 세트가 있으면 kg 분석, 아니면 횟수 분석 */
export function resolveWorkoutAnalysisMode(recordsByDate = {}) {
    let hasWeighted = false;
    let hasRepsOnly = false;

    forEachEligibleSet(recordsByDate, (set) => {
        const { weight, reps } = parseSetMetrics(set);
        if (reps <= 0) return;
        if (weight > 0) {
            hasWeighted = true;
        } else {
            hasRepsOnly = true;
        }
    });

    if (hasWeighted) return 'weight';
    if (hasRepsOnly) return 'reps';
    return null;
}

function roundKg(value) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 10) / 10;
}

function roundReps(value) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
}

function formatKg(value) {
    const n = roundKg(value);
    if (n === null) return '-';
    const hasDecimal = !Number.isInteger(n);
    const formatted = n.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: hasDecimal ? 1 : 0
    });
    return `${formatted}kg`;
}

function formatReps(value) {
    const n = roundReps(value);
    if (n === null) return '-';
    return `${n.toLocaleString('en-US')}회`;
}

function formatChartDateLabel(dateKey) {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    if (parts.length >= 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateKey;
}

function formatNavDate(dateKey) {
    if (!dateKey) return '-';
    return dateKey.replace(/-/g, '.') + '.';
}

function buildWeightWorkoutTypeAnalysis(recordsByDate = {}) {
    const sessions = [];
    let best1rm = 0;
    let bestWeight = 0;
    let bestSessionVolume = 0;

    Object.keys(recordsByDate).forEach(dateKey => {
        const records = recordsByDate[dateKey] || [];
        let dayVolume = 0;
        let dayMaxWeight = 0;
        let hasValid = false;

        records.forEach(record => {
            if (record.is_text_record) return;
            const type = record.workout_type_type;
            if (type && type !== '세트') return;

            parseSets(record).forEach(set => {
                const { weight, reps } = parseSetMetrics(set);
                if (weight <= 0 || reps <= 0) return;
                hasValid = true;
                dayVolume += weight * reps;
                dayMaxWeight = Math.max(dayMaxWeight, weight);
                const e1rm = estimate1RmEpley(weight, reps);
                if (e1rm !== null && e1rm > best1rm) {
                    best1rm = e1rm;
                }
                if (weight > bestWeight) {
                    bestWeight = weight;
                }
            });
        });

        if (hasValid) {
            bestSessionVolume = Math.max(bestSessionVolume, dayVolume);
            sessions.push({
                workout_date: dateKey,
                session_volume_kg: roundKg(dayVolume),
                max_weight_kg: roundKg(dayMaxWeight)
            });
        }
    });

    sessions.sort((a, b) => a.workout_date.localeCompare(b.workout_date));

    return {
        mode: 'weight',
        best: {
            estimated_1rm_kg: roundKg(best1rm),
            max_weight_kg: roundKg(bestWeight),
            max_session_volume_kg: roundKg(bestSessionVolume)
        },
        sessions,
        recentSessions: sessions.slice(-GRAPH_SESSION_LIMIT)
    };
}

function buildRepsWorkoutTypeAnalysis(recordsByDate = {}) {
    const sessions = [];
    let bestMaxSetReps = 0;
    let bestSessionTotalReps = 0;

    Object.keys(recordsByDate).forEach(dateKey => {
        const records = recordsByDate[dateKey] || [];
        let dayTotalReps = 0;
        let dayMaxSetReps = 0;
        let hasValid = false;

        records.forEach(record => {
            if (record.is_text_record) return;
            const type = record.workout_type_type;
            if (type && type !== '세트') return;

            parseSets(record).forEach(set => {
                const { weight, reps } = parseSetMetrics(set);
                if (reps <= 0 || weight > 0) return;
                hasValid = true;
                dayTotalReps += reps;
                dayMaxSetReps = Math.max(dayMaxSetReps, reps);
            });
        });

        if (hasValid) {
            bestMaxSetReps = Math.max(bestMaxSetReps, dayMaxSetReps);
            bestSessionTotalReps = Math.max(bestSessionTotalReps, dayTotalReps);
            sessions.push({
                workout_date: dateKey,
                session_total_reps: roundReps(dayTotalReps),
                max_set_reps: roundReps(dayMaxSetReps)
            });
        }
    });

    sessions.sort((a, b) => a.workout_date.localeCompare(b.workout_date));

    return {
        mode: 'reps',
        best: {
            max_set_reps: roundReps(bestMaxSetReps),
            max_session_total_reps: roundReps(bestSessionTotalReps)
        },
        sessions,
        recentSessions: sessions.slice(-GRAPH_SESSION_LIMIT)
    };
}

export function buildWorkoutTypeAnalysis(recordsByDate = {}) {
    const mode = resolveWorkoutAnalysisMode(recordsByDate);
    if (mode === 'weight') {
        return buildWeightWorkoutTypeAnalysis(recordsByDate);
    }
    if (mode === 'reps') {
        return buildRepsWorkoutTypeAnalysis(recordsByDate);
    }
    return {
        mode: null,
        best: {},
        sessions: [],
        recentSessions: []
    };
}

export function destroyWorkoutAnalysisChart() {
    if (activeChart) {
        activeChart.destroy();
        activeChart = null;
    }
}

function destroyChart() {
    destroyWorkoutAnalysisChart();
}

function buildLegendLabels(chart, barLabel, lineLabel) {
    const datasets = chart.data.datasets;
    const barIndex = datasets.findIndex(d => d.label === barLabel);
    const lineIndex = datasets.findIndex(d => d.label === lineLabel);
    const ordered = [barIndex, lineIndex].filter(i => i >= 0);

    return ordered.map((datasetIndex) => {
        const ds = datasets[datasetIndex];
        const hidden = !chart.isDatasetVisible(datasetIndex);

        if (ds.type === 'line') {
            return {
                text: ds.label,
                fillStyle: 'transparent',
                strokeStyle: ds.borderColor,
                lineWidth: ds.borderWidth || 2,
                hidden,
                datasetIndex,
                pointStyle: 'line',
                rotation: 0
            };
        }

        return {
            text: ds.label,
            fillStyle: ds.backgroundColor,
            strokeStyle: ds.borderColor,
            lineWidth: ds.borderWidth || 1,
            hidden,
            datasetIndex,
            pointStyle: 'rect',
            rotation: 0
        };
    });
}

function attachChartClick(canvas, recentSessions) {
    return {
        onClick: (_event, elements) => {
            if (!elements.length) return;
            const idx = elements[0].index;
            const session = recentSessions[idx];
            if (session && canvas._onSessionSelect) {
                canvas._onSessionSelect(session.workout_date);
            }
        }
    };
}

function renderWeightChart(canvas, recentSessions, selectedDate) {
    destroyChart();
    if (!canvas || !window.Chart || recentSessions.length === 0) {
        return;
    }

    const labels = recentSessions.map(s => formatChartDateLabel(s.workout_date));
    const volumes = recentSessions.map(s => s.session_volume_kg || 0);
    const maxWeights = recentSessions.map(s => s.max_weight_kg || 0);
    const selectedIndex = recentSessions.findIndex(s => s.workout_date === selectedDate);

    const pointRadius = recentSessions.map((_, i) => (i === selectedIndex ? 6 : 3));

    activeChart = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '볼륨',
                    data: volumes,
                    backgroundColor: 'rgba(25, 118, 210, 0.35)',
                    borderColor: 'rgba(25, 118, 210, 0.5)',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: '최대 무게',
                    data: maxWeights,
                    borderColor: '#1565c0',
                    backgroundColor: '#1565c0',
                    borderWidth: 2,
                    tension: 0.25,
                    yAxisID: 'y1',
                    order: 1,
                    pointRadius,
                    pointBackgroundColor: '#1976d2',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        usePointStyle: true,
                        generateLabels(chart) {
                            return buildLegendLabels(chart, '볼륨', '최대 무게');
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.dataset.label || '';
                            const val = ctx.parsed.y;
                            return `${label}: ${formatKg(val)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 }
                },
                y: {
                    position: 'left',
                    beginAtZero: true,
                    grace: '8%',
                    title: { display: true, text: '볼륨', font: { size: 11 } },
                    ticks: { font: { size: 10 } }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    grace: '8%',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: '무게', font: { size: 11 } },
                    ticks: { font: { size: 10 } }
                }
            },
            ...attachChartClick(canvas, recentSessions)
        }
    });
}

function renderRepsChart(canvas, recentSessions, selectedDate) {
    destroyChart();
    if (!canvas || !window.Chart || recentSessions.length === 0) {
        return;
    }

    const labels = recentSessions.map(s => formatChartDateLabel(s.workout_date));
    const totals = recentSessions.map(s => s.session_total_reps || 0);
    const maxSets = recentSessions.map(s => s.max_set_reps || 0);
    const selectedIndex = recentSessions.findIndex(s => s.workout_date === selectedDate);
    const pointRadius = recentSessions.map((_, i) => (i === selectedIndex ? 6 : 3));

    activeChart = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '총 횟수',
                    data: totals,
                    backgroundColor: 'rgba(46, 125, 50, 0.35)',
                    borderColor: 'rgba(46, 125, 50, 0.55)',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: '최대 1세트',
                    data: maxSets,
                    borderColor: '#2e7d32',
                    backgroundColor: '#2e7d32',
                    borderWidth: 2,
                    tension: 0.25,
                    yAxisID: 'y1',
                    order: 1,
                    pointRadius,
                    pointBackgroundColor: '#2e7d32',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        usePointStyle: true,
                        generateLabels(chart) {
                            return buildLegendLabels(chart, '총 횟수', '최대 1세트');
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.dataset.label || '';
                            const val = ctx.parsed.y;
                            return `${label}: ${formatReps(val)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 }
                },
                y: {
                    position: 'left',
                    beginAtZero: true,
                    grace: '8%',
                    title: { display: true, text: '총 횟수', font: { size: 11 } },
                    ticks: { font: { size: 10 }, precision: 0 }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    grace: '8%',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: '1세트', font: { size: 11 } },
                    ticks: { font: { size: 10 }, precision: 0 }
                }
            },
            ...attachChartClick(canvas, recentSessions)
        }
    });
}

/**
 * @returns {{ destroy: function, refresh: function }}
 */
export function mountWorkoutAnalysisPanel(container, { recordsByDate }) {
    destroyChart();

    const analysis = buildWorkoutTypeAnalysis(recordsByDate);
    const { mode, best, sessions, recentSessions } = analysis;

    if (sessions.length === 0 || !mode) {
        container.innerHTML = `
            <div class="workout-analysis-empty">
                <p>횟수 또는 무게·횟수가 입력된 세트 기록이 없어 분석할 수 없습니다.</p>
            </div>
        `;
        return { destroy: destroyChart, refresh: () => {} };
    }

    let selectedIndex = sessions.length - 1;
    let viewMode = 'graph';
    const isRepsMode = mode === 'reps';

    const getSelected = () => sessions[selectedIndex] || sessions[sessions.length - 1];

    const render = () => {
        destroyChart();
        const selected = getSelected();

        const listRows = recentSessions.slice().reverse().map(session => {
            const isActive = session.workout_date === selected.workout_date;
            if (isRepsMode) {
                return `
                <button type="button" class="workout-analysis-list-row ${isActive ? 'is-active' : ''}"
                    data-date="${escapeHtml(session.workout_date)}">
                    <span class="workout-analysis-list-date">${escapeHtml(formatNavDate(session.workout_date))}</span>
                    <span class="workout-analysis-list-stat">총 ${escapeHtml(formatReps(session.session_total_reps))}</span>
                    <span class="workout-analysis-list-stat">최대 ${escapeHtml(formatReps(session.max_set_reps))}</span>
                </button>
            `;
            }
            return `
                <button type="button" class="workout-analysis-list-row ${isActive ? 'is-active' : ''}"
                    data-date="${escapeHtml(session.workout_date)}">
                    <span class="workout-analysis-list-date">${escapeHtml(formatNavDate(session.workout_date))}</span>
                    <span class="workout-analysis-list-stat">볼륨 ${escapeHtml(formatKg(session.session_volume_kg))}</span>
                    <span class="workout-analysis-list-stat">최대 ${escapeHtml(formatKg(session.max_weight_kg))}</span>
                </button>
            `;
        }).join('');

        const prSectionHtml = isRepsMode ? `
                    <div class="workout-analysis-pr-grid workout-analysis-pr-grid--two">
                        <div class="workout-analysis-pr-card">
                            <span class="workout-analysis-pr-label">최고 1세트</span>
                            <span class="workout-analysis-pr-value">${escapeHtml(formatReps(best.max_set_reps))}</span>
                        </div>
                        <div class="workout-analysis-pr-card">
                            <span class="workout-analysis-pr-label">세션 최대 총횟수</span>
                            <span class="workout-analysis-pr-value">${escapeHtml(formatReps(best.max_session_total_reps))}</span>
                        </div>
                    </div>
        ` : `
                    <div class="workout-analysis-pr-grid">
                        <div class="workout-analysis-pr-card">
                            <span class="workout-analysis-pr-label">예상 1RM</span>
                            <span class="workout-analysis-pr-value">${escapeHtml(formatKg(best.estimated_1rm_kg))}</span>
                        </div>
                        <div class="workout-analysis-pr-card">
                            <span class="workout-analysis-pr-label">최고 무게</span>
                            <span class="workout-analysis-pr-value">${escapeHtml(formatKg(best.max_weight_kg))}</span>
                        </div>
                        <div class="workout-analysis-pr-card">
                            <span class="workout-analysis-pr-label">최대 볼륨</span>
                            <span class="workout-analysis-pr-value">${escapeHtml(formatKg(best.max_session_volume_kg))}</span>
                        </div>
                    </div>
        `;

        const sessionStatsHtml = isRepsMode ? `
                        <span class="workout-analysis-session-inline">
                            <span class="workout-analysis-session-item">
                                <span class="workout-analysis-session-stat-label">총 횟수</span>
                                <span class="workout-analysis-session-stat-value">${escapeHtml(formatReps(selected.session_total_reps))}</span>
                            </span>
                            <span class="workout-analysis-session-sep" aria-hidden="true">·</span>
                            <span class="workout-analysis-session-item">
                                <span class="workout-analysis-session-stat-label">최대 1세트</span>
                                <span class="workout-analysis-session-stat-value">${escapeHtml(formatReps(selected.max_set_reps))}</span>
                            </span>
                        </span>
        ` : `
                        <span class="workout-analysis-session-inline">
                            <span class="workout-analysis-session-item">
                                <span class="workout-analysis-session-stat-label">볼륨</span>
                                <span class="workout-analysis-session-stat-value">${escapeHtml(formatKg(selected.session_volume_kg))}</span>
                            </span>
                            <span class="workout-analysis-session-sep" aria-hidden="true">·</span>
                            <span class="workout-analysis-session-item">
                                <span class="workout-analysis-session-stat-label">최대 부하</span>
                                <span class="workout-analysis-session-stat-value">${escapeHtml(formatKg(selected.max_weight_kg))}</span>
                            </span>
                        </span>
        `;

        container.innerHTML = `
            <div class="workout-analysis-panel">
                <section class="workout-analysis-pr">
                    <h4 class="workout-analysis-section-title">최고 기록</h4>
                    ${prSectionHtml}
                </section>
                <section class="workout-analysis-overload">
                    <div class="workout-analysis-overload-header">
                        <div class="workout-analysis-view-toggle" role="tablist" aria-label="보기 방식">
                            <button type="button" class="workout-analysis-toggle-btn ${viewMode === 'graph' ? 'is-active' : ''}" data-view="graph">그래프</button>
                            <button type="button" class="workout-analysis-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}" data-view="list">리스트</button>
                        </div>
                    </div>
                    <div class="workout-analysis-date-nav">
                        <button type="button" class="workout-analysis-date-btn" id="workout-analysis-prev" aria-label="이전 운동일">
                            <span class="workout-analysis-date-chevron" aria-hidden="true">‹</span>
                        </button>
                        <span class="workout-analysis-date-label" id="workout-analysis-date-label">${escapeHtml(formatNavDate(selected.workout_date))}</span>
                        <button type="button" class="workout-analysis-date-btn" id="workout-analysis-next" aria-label="다음 운동일">
                            <span class="workout-analysis-date-chevron" aria-hidden="true">›</span>
                        </button>
                    </div>
                    <div class="workout-analysis-session-stats">
                        ${sessionStatsHtml}
                    </div>
                    <div class="workout-analysis-chart-wrap ${viewMode === 'graph' ? '' : 'is-hidden'}">
                        <canvas id="workout-analysis-chart"></canvas>
                    </div>
                    <div class="workout-analysis-list ${viewMode === 'list' ? '' : 'is-hidden'}">
                        <p class="workout-analysis-list-caption">최근 ${recentSessions.length}세션</p>
                        ${listRows}
                    </div>
                </section>
            </div>
        `;

        const canvas = container.querySelector('#workout-analysis-chart');
        if (canvas && viewMode === 'graph') {
            canvas._onSessionSelect = (dateKey) => {
                const idx = sessions.findIndex(s => s.workout_date === dateKey);
                if (idx >= 0) {
                    selectedIndex = idx;
                    render();
                }
            };
            if (isRepsMode) {
                renderRepsChart(canvas, recentSessions, selected.workout_date);
            } else {
                renderWeightChart(canvas, recentSessions, selected.workout_date);
            }
        }

        const prevBtn = container.querySelector('#workout-analysis-prev');
        const nextBtn = container.querySelector('#workout-analysis-next');
        if (prevBtn) {
            prevBtn.disabled = selectedIndex <= 0;
            prevBtn.addEventListener('click', () => {
                if (selectedIndex > 0) {
                    selectedIndex -= 1;
                    render();
                }
            });
        }
        if (nextBtn) {
            nextBtn.disabled = selectedIndex >= sessions.length - 1;
            nextBtn.addEventListener('click', () => {
                if (selectedIndex < sessions.length - 1) {
                    selectedIndex += 1;
                    render();
                }
            });
        }

        container.querySelectorAll('.workout-analysis-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (view === 'graph' || view === 'list') {
                    viewMode = view;
                    render();
                }
            });
        });

        container.querySelectorAll('.workout-analysis-list-row').forEach(row => {
            row.addEventListener('click', () => {
                const dateKey = row.getAttribute('data-date');
                const idx = sessions.findIndex(s => s.workout_date === dateKey);
                if (idx >= 0) {
                    selectedIndex = idx;
                    render();
                }
            });
        });
    };

    render();

    return {
        destroy: destroyChart,
        refresh: render
    };
}
