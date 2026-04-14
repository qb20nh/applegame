import { SeededRandom, pseudoPermutation } from '../utils/random.js';
import * as patterns from './patterns.js';

export const COLORS = ['orange', 'blue'];
export const TARGET_SUM = 10;

export class GameEngine {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = [];
        this.random = null;
        this.currentStageNumber = 1;
        
        // 누적 합 테이블
        this.prefixSumTable = null;
        this.orangePrefixSumTable = null;
        this.bluePrefixSumTable = null;
        
        // 힌트 캐싱
        this.cachedHints = null;
        this.gameStateChanged = true;
    }

    init(stageNumber, seed) {
        this.currentStageNumber = stageNumber;
        this.random = new SeededRandom(seed);
        this.grid = [];
        this.gameStateChanged = true;
        this.cachedHints = null;

        for (let i = 0; i < this.rows; i++) {
            const row = [];
            for (let j = 0; j < this.cols; j++) {
                const isBlue = this.getColor(i, j);
                row.push({
                    value: this.random.nextInt(1, 9),
                    layerDepth: isBlue ? 1 : 0,
                    color: isBlue ? COLORS[1] : COLORS[0]
                });
            }
            this.grid.push(row);
        }
        this.buildAllPrefixSums();
        return this.grid;
    }

    getColor(row, col) {
        const patternGenerators = [
            patterns.halfSquare,
            patterns.halfStripes,
            patterns.verticalStripes,
            patterns.donuts,
            patterns.checker,
            patterns.diagonalStripes,
            patterns.split50
        ];
        const patternGenerator = patternGenerators[(this.currentStageNumber - 1) % patternGenerators.length];
        return patternGenerator(row, col, this.rows, this.cols);
    }

    buildAllPrefixSums() {
        this.prefixSumTable = this.buildPrefixSum(null);
        this.orangePrefixSumTable = this.buildPrefixSum('orange');
        this.bluePrefixSumTable = this.buildPrefixSum('blue');
    }

    buildPrefixSum(color) {
        const prefixSum = Array(this.rows + 1).fill().map(() => Array(this.cols + 1).fill(0));
        for (let i = 1; i <= this.rows; i++) {
            for (let j = 1; j <= this.cols; j++) {
                const cell = this.grid[i-1][j-1];
                const cellValue = cell && cell.value > 0 && (!color || cell.color === color) ? cell.value : 0;
                prefixSum[i][j] = cellValue + prefixSum[i-1][j] + prefixSum[i][j-1] - prefixSum[i-1][j-1];
            }
        }
        return prefixSum;
    }

    getRectangleSum(prefixSum, r1, c1, r2, c2) {
        return prefixSum[r2+1][c2+1] - prefixSum[r2+1][c1] - prefixSum[r1][c2+1] + prefixSum[r1][c1];
    }

    findHints() {
        if (!this.gameStateChanged && this.cachedHints) return this.cachedHints;

        const hints = [];
        for (const color of COLORS) {
            const colorPrefixSum = color === 'orange' ? this.orangePrefixSumTable : this.bluePrefixSumTable;
            const validCells = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c] && this.grid[r][c].value > 0 && this.grid[r][c].color === color) {
                        validCells.push({row: r, col: c});
                    }
                }
            }

            for (let i = 0; i < validCells.length; i++) {
                const startCell = validCells[i];
                for (let j = i; j < validCells.length; j++) {
                    const endCell = validCells[j];
                    const r1 = Math.min(startCell.row, endCell.row);
                    const c1 = Math.min(startCell.col, endCell.col);
                    const r2 = Math.max(startCell.row, endCell.row);
                    const c2 = Math.max(startCell.col, endCell.col);
                    
                    const sum = this.getRectangleSum(colorPrefixSum, r1, c1, r2, c2);
                    if (sum === TARGET_SUM) {
                        const rectCells = [];
                        for (let r = r1; r <= r2; r++) {
                            for (let c = c1; c <= c2; c++) {
                                if (this.grid[r][c] && this.grid[r][c].value > 0 && this.grid[r][c].color === color) {
                                    rectCells.push({ row: r, col: c, value: this.grid[r][c].value, color: this.grid[r][c].color });
                                }
                            }
                        }
                        if (rectCells.length >= 2 && !this.isDuplicateHint(hints, rectCells)) {
                            hints.push(rectCells);
                        }
                    }
                }
            }
        }
        this.cachedHints = hints;
        this.gameStateChanged = false;
        return hints;
    }

    isDuplicateHint(hints, cells) {
        return hints.some(hint => 
            hint.length === cells.length && 
            hint.every(cell => cells.some(c => c.row === cell.row && c.col === cell.col))
        );
    }

    validateSelection(selectedCellCoords, options = {}) {
        if (selectedCellCoords.length === 0) return { isValid: false };
        
        const { currentHint, lastVisibleHint, secondLastVisibleHint, isHintVisible } = options;
        const firstCell = this.grid[selectedCellCoords[0].row][selectedCellCoords[0].col];
        const color = firstCell.color;
        
        let sum = 0;
        let minR = this.rows, maxR = 0, minC = this.cols, maxC = 0;
        
        for (const coord of selectedCellCoords) {
            const cell = this.grid[coord.row][coord.col];
            if (!cell || cell.value <= 0 || cell.color !== color) return { isValid: false };
            sum += cell.value;
            minR = Math.min(minR, coord.row);
            maxR = Math.max(maxR, coord.row);
            minC = Math.min(minC, coord.col);
            maxC = Math.max(maxC, coord.col);
        }

        if (sum !== TARGET_SUM) return { isValid: false, sum };

        // Calculate Multiplier
        const selectionWidth = maxC - minC + 1;
        const selectionHeight = maxR - minR + 1;
        let multiplier = selectionWidth + selectionHeight - 1;

        // Hint usage check
        const isMatch = (hint, selected) => {
            if (!hint || hint.length !== selected.length) return false;
            return hint.every(h => selected.some(s => s.row === h.row && s.col === h.col));
        };

        const isUsingHint = (isHintVisible && isMatch(currentHint, selectedCellCoords)) ||
                           isMatch(lastVisibleHint, selectedCellCoords) ||
                           isMatch(secondLastVisibleHint, selectedCellCoords);

        if (isUsingHint) {
            multiplier = 1;
        }

        const pointsEarned = multiplier * selectedCellCoords.length;

        // Valid! Calculate new values
        const hintsResult = this.findHints();
        const hintsCount = hintsResult ? hintsResult.length : 0;
        const useBenfordProbability = 1.0 / Math.sqrt(Math.max(1, hintsCount));
        
        const updates = selectedCellCoords.map(coord => {
            const cell = this.grid[coord.row][coord.col];
            const newLayerDepth = cell.layerDepth + 1;
            const newColor = COLORS[newLayerDepth % COLORS.length];
            
            let newValue;
            if (this.random.next() < useBenfordProbability) {
                newValue = this.random.nextInt(1, 9);
            } else {
                const position = coord.row * this.cols + coord.col;
                newValue = (pseudoPermutation(200*9, position, 4, newLayerDepth) % 9) + 1;
            }

            this.grid[coord.row][coord.col] = {
                value: newValue,
                layerDepth: newLayerDepth,
                color: newColor
            };

            return { row: coord.row, col: coord.col, newValue, newLayerDepth, newColor };
        });

        this.gameStateChanged = true;
        this.buildAllPrefixSums();
        
        return { isValid: true, sum, updates, pointsEarned };
    }
}
