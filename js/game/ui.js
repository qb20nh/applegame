import { ROWS, COLS, CELL_SIZE, GRID_GAP, GRID_PADDING, POINTER_TYPE_TOUCH } from './constants.js';
import { state } from './state.js';

export const ui = {
    gameGridElement: null,
    timeElement: null,
    scoreElement: null,
    sumElement: null,
    gameOverElement: null,
    restartBtn: null,
    stageClearInfoElement: null,
    stageStarsElement: null,
    nextStageBtn: null,
    stageSelectBtn: null,
    cellElements: {},

    initElements() {
        this.gameGridElement = document.getElementById('game-grid');
        this.timeElement = document.getElementById('time');
        this.scoreElement = document.getElementById('score');
        this.sumElement = document.getElementById('sum');
        this.gameOverElement = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');
        this.stageClearInfoElement = document.getElementById('stage-clear-info');
        this.stageStarsElement = document.getElementById('stage-stars');
        this.nextStageBtn = document.getElementById('next-stage-btn');
        this.stageSelectBtn = document.getElementById('stage-select-btn');
    },

    setGridCSS() {
        const rows = state.rows;
        const cols = state.cols;

        document.documentElement.style.setProperty('--grid-rows', rows);
        document.documentElement.style.setProperty('--grid-cols', cols);
        document.documentElement.style.setProperty('--cell-size', `${CELL_SIZE}px`);
        document.documentElement.style.setProperty('--grid-gap', `${GRID_GAP}px`);
        document.documentElement.style.setProperty('--grid-padding', `${GRID_PADDING}px`);
    },

    updateUI() {
        if (this.scoreElement) this.scoreElement.textContent = state.score;
        if (this.timeElement) {
            this.timeElement.textContent = Math.ceil(state.timeLeft);
            
            // 시간 경과에 따른 시각적 경고 효과
            this.timeElement.classList.remove('time-warning', 'time-blink-10', 'time-blink-5', 'time-blink-1');
            if (state.timeLeft <= 10) {
                this.timeElement.classList.add('time-warning');
                if (state.timeLeft <= 1) this.timeElement.classList.add('time-blink-1');
                else if (state.timeLeft <= 5) this.timeElement.classList.add('time-blink-5');
                else this.timeElement.classList.add('time-blink-10');
            }
        }
        if (this.sumElement) {
            this.sumElement.textContent = state.selectedSum;
            this.sumElement.parentElement.classList.toggle('visible', state.selectedSum > 0);
        }
    },

    renderGrid(aspect) {
        if (!this.gameGridElement) return;
        this.gameGridElement.innerHTML = '';
        this.cellElements = {};
        
        const rows = state.rows;
        const cols = state.cols;

        const isVertical = aspect < 1;
        const displayRows = isVertical ? cols : rows;
        const displayCols = isVertical ? rows : cols;
        
        this.gameGridElement.style.gridTemplateRows = `repeat(${displayRows}, ${CELL_SIZE}px)`;
        this.gameGridElement.style.gridTemplateColumns = `repeat(${displayCols}, ${CELL_SIZE}px)`;
        
        state.emptyCellCount = 0;
        
        for (let i = 0; i < displayRows; i++) {
            for (let j = 0; j < displayCols; j++) {
                const originalRow = isVertical ? (rows - 1 - j) : i;
                const originalCol = isVertical ? i : j;
                
                const cell = state.grid[originalRow][originalCol];
                const cellElement = document.createElement('div');
                cellElement.className = 'cell';
                cellElement.dataset.row = originalRow;
                cellElement.dataset.col = originalCol;
                
                const cellId = `${originalRow}-${originalCol}`;
                this.cellElements[cellId] = cellElement;
                
                if (cell && cell.value > 0) {
                    cellElement.textContent = cell.value;
                    cellElement.classList.add(`${cell.color}-layer`);
                } else {
                    cellElement.classList.add('empty');
                    state.emptyCellCount++;
                }
                
                this.gameGridElement.appendChild(cellElement);
            }
        }
    }
};
