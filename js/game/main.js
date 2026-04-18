import { Timer } from '../utils/timer.js';
import { isLocalhost } from '../utils/util.js';
import { ROWS, COLS, TARGET_SUM, TIME_LIMIT, COLORS, POINTER_TYPE_TOUCH, STAR_THRESHOLDS } from './constants.js';
import { state, gameState, generateStageSeed } from './state.js';
import { ui } from './ui.js';
import { getCellCoordinatesFromPosition, selectCellsInRange, clearSelection } from './input.js';
import { startPhysicsAnimation, explodeCellsGrid } from './animations.js';

const noop = () => {};
const IS_LOCALHOST = isLocalhost();

// Web Worker 초기화
const gameWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// 전역 인터페이스 제공 (레거시 지원 및 디버깅)
if (IS_LOCALHOST) {
    globalThis.gameWorker = gameWorker;
}

// 타이머 객체 (가변형으로 변경)
let gameTimer;
let timerUIUpdateInterval;
const MAX_ZEN_HISTORY = 64;
const zenHistory = {
    past: [],
    future: []
};

const isZenMode = () => state.gameMode === 'zen';

function normalizeScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
}

function packGridSnapshot(grid, rows, cols) {
    const size = rows * cols;
    const values = new Uint8Array(size);
    const depths = new Uint16Array(size);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = grid[r]?.[c];
            values[idx] = cell?.value ?? 0;
            depths[idx] = cell?.layerDepth ?? 0;
            idx++;
        }
    }
    return { rows, cols, values, depths };
}

function unpackGridSnapshot(snapshot) {
    const { rows, cols, values, depths } = snapshot;
    const grid = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const value = values[idx];
            const layerDepth = depths[idx];
            row.push({
                value,
                layerDepth,
                color: COLORS[layerDepth % COLORS.length]
            });
            idx++;
        }
        grid.push(row);
    }
    return grid;
}

function resetZenHistory() {
    zenHistory.past = [];
    zenHistory.future = [];
    updateZenButtons();
}

function captureZenSnapshot() {
    const packed = packGridSnapshot(state.grid, state.rows, state.cols);
    return {
        ...packed,
        score: state.score
    };
}

function pushZenHistory() {
    if (!isZenMode()) return;
    if (zenHistory.past.length >= MAX_ZEN_HISTORY) zenHistory.past.shift();
    zenHistory.past.push(captureZenSnapshot());
    zenHistory.future = [];
    updateZenButtons();
}

function applyZenSnapshot(snapshot) {
    state.cachedHints = null;
    state.currentHint = null;
    state.lastVisibleHint = null;
    state.secondLastVisibleHint = null;
    state.lastShownHintIndex = -1;
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    state.grid = unpackGridSnapshot(snapshot);
    state.score = snapshot.score;
    hideHint();
    clearSelection();
    ui.renderGrid(window.innerWidth / window.innerHeight);
    ui.updateUI();
    gameWorker.postMessage({ type: 'SET_GRID', payload: { grid: state.grid } });
    precomputeHints();
    if (!state.isPaused) {
        hintWaitTimer.start();
    }
}

function undoZen() {
    if (!isZenMode() || zenHistory.past.length === 0) return;
    zenHistory.future.push(captureZenSnapshot());
    const previous = zenHistory.past.pop();
    applyZenSnapshot(previous);
    updateZenButtons();
}

function redoZen() {
    if (!isZenMode() || zenHistory.future.length === 0) return;
    zenHistory.past.push(captureZenSnapshot());
    const next = zenHistory.future.pop();
    applyZenSnapshot(next);
    updateZenButtons();
}

function initTimers(limit) {
    if (gameTimer) gameTimer.reset();
    clearInterval(timerUIUpdateInterval);
    
    gameTimer = new Timer(() => {
        clearInterval(timerUIUpdateInterval);
        explodeTimerDisplay(() => {
            explodeCellsGrid([...ui.gameGridElement.querySelectorAll('.cell:not(.empty)')], () => {
                checkStageCompletion('시간 초과!');
            });
        });
    }, limit * 1000);

    gameTimer.onStart(() => timerUIUpdateInterval = setInterval(updateTimerUI, 100));
    gameTimer.onResume(() => timerUIUpdateInterval = setInterval(updateTimerUI, 100));
    gameTimer.onPause(() => clearInterval(timerUIUpdateInterval));
    gameTimer.onReset(() => clearInterval(timerUIUpdateInterval));
}

const hintWaitTimer = new Timer(showHint, 5000);
const hintDisplayTimer = new Timer(hideHint, 3000);
hintWaitTimer.then(hintDisplayTimer).then(hintWaitTimer);

// --- Stage Data Logic ---
const stageData = {
    totalStages: 1000,
    completedStages: 0,
    campaignStageScores: {},
    zenStageScores: {},
    currentPage: 1,
    stagesPerPage: 100,
    loadFromStorage() {
        const stored = localStorage.getItem('stageData');
        this.completedStages = 0;
        this.campaignStageScores = {};
        this.zenStageScores = {};
        state.frenzyHighScore = 0;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                this.completedStages = Math.max(0, Math.floor(Number(parsed.completedStages) || 0));
                const campaignRawScores = parsed.campaignStageScores && typeof parsed.campaignStageScores === 'object'
                    ? parsed.campaignStageScores
                    : (parsed.stageScores && typeof parsed.stageScores === 'object' ? parsed.stageScores : {});
                const zenRawScores = parsed.zenStageScores && typeof parsed.zenStageScores === 'object'
                    ? parsed.zenStageScores
                    : {};

                this.campaignStageScores = Object.fromEntries(
                    Object.entries(campaignRawScores).map(([stage, score]) => [stage, normalizeScore(score)])
                );
                this.zenStageScores = Object.fromEntries(
                    Object.entries(zenRawScores).map(([stage, score]) => [stage, normalizeScore(score)])
                );
                state.frenzyHighScore = normalizeScore(parsed.frenzyHighScore);
            } catch (e) { console.error(e); }
        }
    },
    saveToStorage() {
        localStorage.setItem('stageData', JSON.stringify({
            completedStages: this.completedStages,
            campaignStageScores: this.campaignStageScores,
            zenStageScores: this.zenStageScores,
            frenzyHighScore: state.frenzyHighScore
        }));
    },
    recordStageScore(stageNumber, score, mode = 'stage') {
        const normalizedScore = normalizeScore(score);
        const isZen = mode === 'zen';
        const scoreTable = isZen ? this.zenStageScores : this.campaignStageScores;
        const currentBest = normalizeScore(scoreTable[stageNumber]);
        if (normalizedScore > currentBest) {
            scoreTable[stageNumber] = normalizedScore;
        }
        this.saveToStorage();
    },
    clearStage(stageNumber) {
        if (stageNumber > this.completedStages) this.completedStages = stageNumber;
        this.saveToStorage();
    }
};

// --- Dialogs ---
const modeSelectionDialog = document.getElementById('mode-selection-dialog');
const stageDialog = document.getElementById('stage-selection-dialog');
const pauseMenuDialog = document.getElementById('pause-menu-dialog');
const confirmationDialog = document.getElementById('confirmation-dialog');
let pendingAction = null;

function updateZenButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const isZen = isZenMode() && ui.gameOverElement?.style.display !== 'flex';

    if (undoBtn) {
        undoBtn.style.display = isZen ? 'flex' : 'none';
        undoBtn.disabled = !isZen || zenHistory.past.length === 0;
    }
    if (redoBtn) {
        redoBtn.style.display = isZen ? 'flex' : 'none';
        redoBtn.disabled = !isZen || zenHistory.future.length === 0;
    }
}

function showModeSelection() {
    if (gameTimer) gameTimer.reset();
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    state.isPaused = false;
    ui.gameGridElement?.classList.remove('paused');
    
    stageData.loadFromStorage();
    updateZenButtons();
    modeSelectionDialog?.showModal();
}

function showStageSelection() {
    stageData.currentPage = 1;
    if (stageDialog) stageDialog.scrollTop = 0;
    const dialogContent = stageDialog?.querySelector('.dialog-content');
    if (dialogContent) dialogContent.scrollTop = 0;
    const stageContainer = stageDialog?.querySelector('.stages-container');
    if (stageContainer) stageContainer.scrollTop = 0;
    generateStages();
    stageDialog?.showModal();
}

function generateStages() {
    const container = document.querySelector('.stages-container');
    const template = document.getElementById('stage-template');
    const pageDisplay = document.getElementById('page-display');
    const pageNumbersContainer = document.querySelector('.page-numbers');
    const pageInfo = document.querySelector('.page-info');
    const pagination = document.querySelector('.pagination');
    const noticeElement = document.getElementById('stage-selection-notice');
    
    if (!container || !template) return;
    
    container.innerHTML = '';
    const totalPages = Math.ceil(stageData.totalStages / stageData.stagesPerPage);
    const startStage = (stageData.currentPage - 1) * stageData.stagesPerPage + 1;
    const endStage = Math.min(startStage + stageData.stagesPerPage - 1, stageData.totalStages);
    
    if (pageDisplay) {
        pageDisplay.textContent = `페이지 ${stageData.currentPage} / ${totalPages}`;
    }

    if (noticeElement) {
        noticeElement.hidden = true;
        noticeElement.textContent = '';
    }

    const isZen = isZenMode();
    if (isZen && stageData.completedStages < 1) {
        if (pageInfo) pageInfo.style.display = 'none';
        if (pagination) pagination.style.display = 'none';
        if (noticeElement) {
            noticeElement.hidden = false;
            noticeElement.textContent = '젠 모드를 시작하려면 캠페인에서 최소 1개 스테이지를 클리어하세요.';
        }
        return;
    }

    if (pageInfo) pageInfo.style.display = '';
    if (pagination) pagination.style.display = '';

    if (pageNumbersContainer) {
        pageNumbersContainer.innerHTML = '';
        const range = 2;
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= stageData.currentPage - range && p <= stageData.currentPage + range)) {
                const pBtn = document.createElement('div');
                pBtn.className = 'page-number' + (p === stageData.currentPage ? ' active' : '');
                pBtn.textContent = p;
                pBtn.onclick = () => {
                    stageData.currentPage = p;
                    generateStages();
                };
                pageNumbersContainer.appendChild(pBtn);
            } else if (p === stageData.currentPage - range - 1 || p === stageData.currentPage + range + 1) {
                const dot = document.createElement('div');
                dot.textContent = '...';
                pageNumbersContainer.appendChild(dot);
            }
        }
    }
    
    for (let i = startStage; i <= endStage; i++) {
        const isUnlocked = isZen ? i <= stageData.completedStages : i <= stageData.completedStages + 1;
        const stageItem = template.content.cloneNode(true).querySelector('.stage-item');
        stageItem.classList.add(isUnlocked ? 'completed' : 'locked');
        stageItem.querySelector('.stage-number').textContent = i;
        if (isUnlocked) {
            const score = normalizeScore(
                isZen ? stageData.zenStageScores[i] : stageData.campaignStageScores[i]
            );
            const starsContainer = stageItem.querySelector('.stars');
            if (starsContainer) {
                starsContainer.textContent = '';
                if (isZen) {
                    const scoreLabel = document.createElement('span');
                    scoreLabel.className = 'best-score';
                    scoreLabel.textContent = score > 0 ? `🏆${score}` : '-';
                    starsContainer.appendChild(scoreLabel);
                } else {
                    if (score >= STAR_THRESHOLDS.ONE) {
                        const stars = document.createElement('span');
                        if (score >= STAR_THRESHOLDS.THREE) stars.textContent = '★★★';
                        else if (score >= STAR_THRESHOLDS.TWO) stars.textContent = '★★☆';
                        else stars.textContent = '★☆☆';
                        starsContainer.appendChild(stars);
                    }
                }
            }
            stageItem.addEventListener('click', () => {
                state.gameMode = isZen ? 'zen' : 'stage';
                state.rows = 5;
                state.cols = 10;
                state.currentStageNumber = i;
                stageDialog.close();
                initGame();
            });
        }
        container.appendChild(stageItem);
    }
}

function pauseGame() {
    if (state.isPaused) return;
    state.isPaused = true;
    if (gameTimer) gameTimer.pause();
    hintWaitTimer.pause();
    hintDisplayTimer.pause();
    ui.gameGridElement?.classList.add('paused');
    Object.values(ui.cellElements).forEach(el => {
        if (!el.classList.contains('empty')) {
            el.dataset.val = el.textContent;
            el.textContent = '';
        }
    });
}

function resumeGame() {
    if (!state.isPaused) return;
    state.isPaused = false;
    if (gameTimer) gameTimer.resume();
    // Only resume hints if not in Frenzy mode
    if (state.gameMode !== 'frenzy') {
        hintWaitTimer.resume();
        hintDisplayTimer.resume();
    }
    ui.gameGridElement?.classList.remove('paused');
    Object.values(ui.cellElements).forEach(el => {
        if (el.dataset.val) {
            el.textContent = el.dataset.val;
            delete el.dataset.val;
        }
    });
    syncGridVisualStateAfterRender();
}

function syncGridVisualStateAfterRender() {
    if (state.isPaused) {
        ui.gameGridElement?.classList.add('paused');
        Object.values(ui.cellElements).forEach(el => {
            if (!el.classList.contains('empty')) {
                el.dataset.val = el.textContent;
                el.textContent = '';
            }
        });
    } else {
        ui.gameGridElement?.classList.remove('paused');
        Object.values(ui.cellElements).forEach(el => {
            if (el.dataset.val) {
                el.textContent = el.dataset.val;
                delete el.dataset.val;
            }
        });
    }

    if (state.isSelecting && state.selectionStartCell && state.selectionEndCell) {
        selectCellsInRange(state.selectionStartCell, state.selectionEndCell);
    } else if (state.selectedCells.length > 0) {
        state.selectedCells.forEach(cell => {
            const el = ui.cellElements[`${cell.row}-${cell.col}`];
            if (el) el.classList.add('selected');
        });
    }

    if (state.isHintVisible && state.currentHint) {
        state.currentHint.forEach(cell => {
            const el = ui.cellElements[`${cell.row}-${cell.col}`];
            if (el) el.classList.add('hint');
        });
    }
}

function handleViewportChange() {
    if (!ui.gameGridElement || !state.grid || state.grid.length === 0) return;
    ui.renderGrid(window.innerWidth / window.innerHeight);
    syncGridVisualStateAfterRender();
    ui.updateUI();
}

// Worker 메시지 핸들러
gameWorker.onmessage = function(e) {
    const { type, payload } = e.data;
    switch (type) {
        case 'INIT_COMPLETE':
            state.grid = payload.grid;
            ui.renderGrid(window.innerWidth / window.innerHeight);
            if (gameTimer) gameTimer.start();
            // Only start hints if not in Frenzy mode
            if (state.gameMode !== 'frenzy') {
                hintWaitTimer.start();
            }
            precomputeHints();
            if (isZenMode()) {
                resetZenHistory();
                updateZenButtons();
            }
            break;
        case 'VALIDATION_RESULT':
            handleValidationResult(payload);
            break;
        case 'HINTS_RESULT':
            state.cachedHints = payload.hints;
            if (state.cachedHints && state.cachedHints.length === 0) {
                checkStageCompletion('가능한 조합이 없습니다.');
            }
            break;
        case 'GRID_SYNCED':
            break;
    }
};

function updateTimerUI() {
    if (state.isPaused) return;
    state.timeLeft = gameTimer ? Math.max(0, gameTimer.getRemainingTime() / 1000) : 0;
    ui.updateUI();
}

function initGame() {
    const isFrenzy = state.gameMode === 'frenzy';
    const isZen = isZenMode();
    const isTimed = !isZen;
    const limit = isFrenzy ? 10 : TIME_LIMIT;

    if (isTimed) {
        initTimers(limit);
    } else {
        if (gameTimer) gameTimer.reset();
        gameTimer = null;
        clearInterval(timerUIUpdateInterval);
    }
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    resetZenHistory();
    
    if (ui.gameOverElement) ui.gameOverElement.style.display = 'none';
    state.score = 0;
    state.isPaused = false;
    state.timeLeft = isTimed ? limit : Number.POSITIVE_INFINITY;
    ui.updateUI();
    
    if (ui.gameGridElement) ui.gameGridElement.classList.remove('paused');
    ui.setGridCSS();
    
    gameWorker.postMessage({
        type: 'INIT',
        payload: {
            rows: state.rows,
            cols: state.cols,
            stageNumber: isFrenzy ? 7 : state.currentStageNumber,
            seed: generateStageSeed(isFrenzy ? 999 : state.currentStageNumber),
            gameMode: state.gameMode
        }
    });
}

function handleValidationResult(result) {
    const { isValid, updates, pointsEarned } = result;
    if (isValid) {
        if (isZenMode()) pushZenHistory();
        revealUpdatesWithAnimation(updates);
        updates.forEach(upd => {
            state.grid[upd.row][upd.col] = {
                value: upd.newValue,
                layerDepth: upd.newLayerDepth,
                color: upd.newColor
            };
        });
        state.score += pointsEarned;
        
        if (state.gameMode === 'frenzy') {
            if (gameTimer) {
                gameTimer.reset();
                gameTimer.start();
            }
        }

        ui.updateUI();
        state.lastClearTime = Date.now();
        hideHint();
        precomputeHints();
    } else {
        clearSelection();
    }
}

function revealUpdatesWithAnimation(updates) {
    const sortedUpdates = [...updates].sort((a, b) => (a.row !== b.row) ? a.row - b.row : a.col - b.col);
    sortedUpdates.forEach((upd, index) => {
        setTimeout(() => {
            const cellEl = ui.cellElements[`${upd.row}-${upd.col}`];
            if (!cellEl) return;
            
            const rect = cellEl.getBoundingClientRect();
            const clone = cellEl.cloneNode(true);
            Object.assign(clone.style, {
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                zIndex: '1000',
                pointerEvents: 'none'
            });
            clone.classList.add('falling');
            document.body.appendChild(clone);

            cellEl.textContent = upd.newValue || '';
            cellEl.classList.remove('orange-layer', 'blue-layer', 'empty');
            if (upd.newValue > 0) {
                cellEl.classList.add(`${upd.newColor}-layer`);
            } else {
                cellEl.classList.add('empty');
            }

            const physics = {
                angle: (45 + Math.random() * 90) * Math.PI / 180,
                initialSpeed: 200 + Math.random() * 100,
                rotationSpeed: -360 + Math.random() * 720,
                gravity: 980,
                duration: 400 + Math.random() * 400,
                startTime: null,
                x: 0, y: 0, rotation: 0, opacity: 1, element: clone
            };
            startPhysicsAnimation(physics, () => clone.remove());
        }, index * 50);
    });
    clearSelection();
}

function precomputeHints() {
    gameWorker.postMessage({ type: 'GET_HINTS' });
}

function showHint() {
    // Disable hints completely in Frenzy mode
    if (state.gameMode === 'frenzy') return;
    if (state.timeLeft <= 0 || state.isPaused) return;
    
    hideHint();
    
    const hints = state.cachedHints || [];
    if (hints.length === 0) return;
    
    let index;
    do {
        index = Math.floor(Math.random() * hints.length);
    } while (index === state.lastShownHintIndex && hints.length > 1);
    
    state.currentHint = hints[index];
    state.lastShownHintIndex = index;
    
    state.currentHint.forEach(cell => {
        const el = ui.cellElements[`${cell.row}-${cell.col}`];
        if (el) el.classList.add('hint');
    });
    state.isHintVisible = true;
}

function hideHint() {
    document.querySelectorAll('.cell.hint').forEach(el => el.classList.remove('hint'));
    state.isHintVisible = false;
}

function checkStageCompletion(message) {
    if (state.gameMode === 'frenzy') {
        if (state.score > state.frenzyHighScore) {
            state.frenzyHighScore = state.score;
            stageData.saveToStorage();
            message = `New Frenzy High Score: ${state.score}!`;
        } else {
            message = `Frenzy Over! Score: ${state.score} (High: ${state.frenzyHighScore})`;
        }
        endGame(message, true);
        return;
    }

    if (isZenMode()) {
        stageData.recordStageScore(state.currentStageNumber, state.score, 'zen');
        endGame(`Zen 완료! 점수: ${state.score}. 최고 점수: ${normalizeScore(stageData.zenStageScores[state.currentStageNumber])}`);
        return;
    }

    if (state.score < 50) {
        endGame(message);
        return;
    }
    stageData.recordStageScore(state.currentStageNumber, state.score, 'stage');
    stageData.clearStage(state.currentStageNumber);
    if (ui.stageClearInfoElement) ui.stageClearInfoElement.style.display = 'block';
    if (ui.nextStageBtn) ui.nextStageBtn.style.display = 'block';
    endGame(message);
}

function endGame(message, isFrenzy = false) {
    if (gameTimer) gameTimer.reset();
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    hideHint();
    clearSelection();
    if (ui.gameOverElement) {
        ui.gameOverElement.style.display = 'flex';
        const msgEl = document.getElementById('game-over-message') || document.getElementById('result-message');
        if (msgEl) msgEl.textContent = message;
        if (ui.stageSelectBtn) {
            ui.stageSelectBtn.textContent = isFrenzy ? '돌아가기' : '스테이지 선택';
        }
        
        if (isFrenzy || isZenMode()) {
           if (ui.stageClearInfoElement) ui.stageClearInfoElement.style.display = 'none';
           if (ui.nextStageBtn) ui.nextStageBtn.style.display = 'none';
        } else {
            if (state.score >= STAR_THRESHOLDS.ONE) {
                if (ui.stageStarsElement) {
                    let starsHTML = '';
                    if (state.score >= STAR_THRESHOLDS.THREE) starsHTML = '★★★';
                    else if (state.score >= STAR_THRESHOLDS.TWO) starsHTML = '★★☆';
                    else starsHTML = '★☆☆';
                    ui.stageStarsElement.innerHTML = starsHTML;
                }
            } else if (ui.stageStarsElement) {
                ui.stageStarsElement.innerHTML = '';
            }
        }
    }
    updateZenButtons();
}

function explodeTimerDisplay(onComplete) {
    onComplete();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    ui.initElements();
    ui.setGridCSS();
    stageData.loadFromStorage();

    let activePointerId = null;
    let isTwoFingerPanning = false;
    let lastTwoFingerCenterX = null;
    let resizeTimer = null;

    const isPlayableCell = (cell) => {
        if (!cell) return false;
        const tile = state.grid?.[cell.row]?.[cell.col];
        return Boolean(tile && tile.value > 0);
    };

    // Pointer Events
    ui.gameGridElement?.addEventListener('pointerdown', (e) => {
        if (state.isPaused || state.timeLeft <= 0 || state.isSelecting || isTwoFingerPanning) return;

        const startCell = getCellCoordinatesFromPosition(e.clientX, e.clientY, window.innerWidth / window.innerHeight);
        if (!isPlayableCell(startCell)) return;

        activePointerId = e.pointerId;
        if (e.pointerType === POINTER_TYPE_TOUCH) e.preventDefault();
        try {
            ui.gameGridElement?.setPointerCapture?.(e.pointerId);
        } catch (_) {
            // Some browsers can throw if capture cannot be established.
        }

        state.isSelecting = true;
        state.selectionStartCell = startCell;
        state.selectionEndCell = startCell;
        selectCellsInRange(state.selectionStartCell, state.selectionEndCell);
    });

    document.addEventListener('pointermove', (e) => {
        if (!state.isSelecting || e.pointerId !== activePointerId) return;
        if (e.pointerType === POINTER_TYPE_TOUCH) e.preventDefault();

        const current = getCellCoordinatesFromPosition(e.clientX, e.clientY, window.innerWidth / window.innerHeight);
        if (!state.selectionEndCell || current.row !== state.selectionEndCell.row || current.col !== state.selectionEndCell.col) {
            state.selectionEndCell = current;
            selectCellsInRange(state.selectionStartCell, state.selectionEndCell);
        }
    });

    const finalizeSelection = (e) => {
        if (!state.isSelecting || e.pointerId !== activePointerId) return;

        try {
            if (ui.gameGridElement?.hasPointerCapture?.(e.pointerId)) {
                ui.gameGridElement.releasePointerCapture(e.pointerId);
            }
        } catch (_) {
            // Ignore release failures and continue finalization.
        } finally {
            activePointerId = null;
            state.isSelecting = false;
        }

        if (state.selectedCells.length > 0) {
            gameWorker.postMessage({
                type: 'VALIDATE_SELECTION',
                payload: {
                    cells: state.selectedCells.map(c => ({ row: c.row, col: c.col })),
                    currentHint: state.currentHint,
                    isHintVisible: state.isHintVisible
                }
            });
        } else {
            clearSelection();
        }
    };

    document.addEventListener('pointerup', finalizeSelection);
    document.addEventListener('pointercancel', finalizeSelection);

    // iOS/Safari fallback: prevent touchmove scroll/pull-to-refresh while selecting on the grid.
    // Also support two-finger horizontal pan to scroll overflowed boards.
    ui.gameGridElement?.addEventListener('touchstart', (e) => {
        if (state.isPaused || state.timeLeft <= 0) return;

        if (e.touches.length >= 2) {
            isTwoFingerPanning = true;
            const [t1, t2] = e.touches;
            lastTwoFingerCenterX = (t1.clientX + t2.clientX) / 2;
            activePointerId = null;
            state.isSelecting = false;
            clearSelection();
            e.preventDefault();
            return;
        }

        const touch = e.touches?.[0];
        if (!touch) return;

        const startCell = getCellCoordinatesFromPosition(touch.clientX, touch.clientY, window.innerWidth / window.innerHeight);
        if (isPlayableCell(startCell)) e.preventDefault();
    }, { passive: false });

    ui.gameGridElement?.addEventListener('touchmove', (e) => {
        if (!isTwoFingerPanning || e.touches.length < 2 || !ui.gameGridElement) return;

        const [t1, t2] = e.touches;
        const centerX = (t1.clientX + t2.clientX) / 2;
        if (lastTwoFingerCenterX !== null) {
            const deltaX = centerX - lastTwoFingerCenterX;
            ui.gameGridElement.scrollLeft -= deltaX;
        }
        lastTwoFingerCenterX = centerX;
        e.preventDefault();
    }, { passive: false });

    const endTwoFingerPan = (e) => {
        if (e.touches.length < 2) {
            isTwoFingerPanning = false;
            lastTwoFingerCenterX = null;
        }
    };

    ui.gameGridElement?.addEventListener('touchend', endTwoFingerPan, { passive: false });
    ui.gameGridElement?.addEventListener('touchcancel', endTwoFingerPan, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (state.isSelecting || isTwoFingerPanning) e.preventDefault();
    }, { passive: false });

    // UI Buttons
    ui.restartBtn?.addEventListener('click', () => initGame());
    ui.nextStageBtn?.addEventListener('click', () => {
        state.currentStageNumber++;
        initGame();
    });
    ui.stageSelectBtn?.addEventListener('click', () => {
        if (state.gameMode === 'frenzy') {
            if (ui.gameOverElement) ui.gameOverElement.style.display = 'none';
            showModeSelection();
            return;
        }
        showStageSelection();
    });

    document.getElementById('close-stage-selection')?.addEventListener('click', () => {
        stageDialog.close();
        showModeSelection(); // Return to mode selection when closed
    });
    
    document.getElementById('pause-btn')?.addEventListener('click', () => {
        pauseGame();
        pauseMenuDialog?.showModal();
    });
    
    document.getElementById('continue-btn')?.addEventListener('click', () => {
        pauseMenuDialog?.close();
        resumeGame();
    });
    
    document.getElementById('restart-from-pause-btn')?.addEventListener('click', () => {
        pauseMenuDialog?.close();
        pendingAction = 'restart';
        confirmationDialog?.showModal();
    });
    
    document.getElementById('give-up-btn')?.addEventListener('click', () => {
        pauseMenuDialog?.close();
        pendingAction = 'giveup';
        confirmationDialog?.showModal();
    });

    document.getElementById('confirm-no-btn')?.addEventListener('click', () => {
        confirmationDialog?.close();
        pauseMenuDialog?.showModal();
    });

    document.getElementById('confirm-yes-btn')?.addEventListener('click', () => {
        confirmationDialog?.close();
        if (pendingAction === 'restart') {
            initGame();
        } else if (pendingAction === 'giveup') {
            showModeSelection();
        }
        pendingAction = null;
    });

    // Mode Selection Buttons
    document.getElementById('mode-stage-btn')?.addEventListener('click', () => {
        modeSelectionDialog.close();
        state.gameMode = 'stage';
        showStageSelection();
    });

    document.getElementById('mode-zen-btn')?.addEventListener('click', () => {
        modeSelectionDialog.close();
        state.gameMode = 'zen';
        showStageSelection();
    });

    document.getElementById('mode-frenzy-btn')?.addEventListener('click', () => {
        modeSelectionDialog.close();
        state.gameMode = 'frenzy';
        state.rows = 10;
        state.cols = 20;
        state.currentStageNumber = 7; 
        initGame();
    });

    // Pagination Listeners
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (stageData.currentPage > 1) {
            stageData.currentPage--;
            generateStages();
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(stageData.totalStages / stageData.stagesPerPage);
        if (stageData.currentPage < totalPages) {
            stageData.currentPage++;
            generateStages();
        }
    });

    document.getElementById('undo-btn')?.addEventListener('click', undoZen);
    document.getElementById('redo-btn')?.addEventListener('click', redoZen);
    document.addEventListener('keydown', (e) => {
        if (!isZenMode()) return;
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undoZen();
        } else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redoZen();
        }
    });

    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleViewportChange, 100);
    });
    window.addEventListener('orientationchange', handleViewportChange);

    // Initial Start
    showModeSelection();
});
