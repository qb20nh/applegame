
import { pseudoPermutation } from './feistel.min.js';

// 게임 변수 초기화
const ROWS = 10;
const COLS = 20;
const TARGET_SUM = 10;
const GAME_TIME = 100;
const CELL_SIZE = 32; // 셀 크기(픽셀)
const GRID_GAP = 4;   // 그리드 셀 간격(픽셀)
const GRID_PADDING = 4; // 그리드 패딩(픽셀)
const HINT_DELAY = 5000; // 힌트가 표시되기까지의 시간(ms)
const HINT_DURATION = 2000; // 힌트 표시 지속 시간(ms)

let grid = [];
let selectedCells = [];
let score = 0;
let timeLeft = GAME_TIME;
let gameTimer;
let isSelecting = false;
let selectionStartCell = null;
let selectionEndCell = null;  // 선택 종료 셀 추가
let emptyCellCount = 0;
let currentSelectionSize = null;
let lastClearTime = 0; // 마지막으로 셀을 클리어한 시간
let hintTimer = null; // 힌트 타이머
let currentHint = null; // 현재 표시 중인 힌트
let isHintVisible = false; // 힌트 표시 상태
let lastVisibleHint = null; // 가장 최근에 표시된 힌트 저장
let secondLastVisibleHint = null; // 두 번째로 최근에 표시된 힌트 저장

// 추가: 힌트 캐싱을 위한 변수들
let cachedHints = null; // 캐시된 힌트 목록
let gameStateChanged = true; // 게임 상태 변경 여부
let lastShownHintIndex = -1; // 마지막으로 표시된 힌트의 인덱스

// 레이어 시스템을 위한 변수
const COLORS = ['orange', 'blue']; // 색상 순환 배열
let maxLayerDepth = 0; // 현재까지의 최대 레이어 깊이 (게임 종료 조건으로 활용 가능)

// 누적 합 테이블을 전역 변수로 저장 (그리드 상태 변화에 따라 점진적으로 업데이트)
let prefixSumTable = null;
// 색상별 누적 합 테이블 (주황색/파란색 각각)
let orangePrefixSumTable = null;
let bluePrefixSumTable = null;

// DOM 요소
const gameGridElement = document.getElementById('game-grid');
const timeElement = document.getElementById('time');
const scoreElement = document.getElementById('score');
const sumElement = document.getElementById('sum');
const gameOverElement = document.getElementById('game-over');
const resultMessageElement = document.getElementById('result-message');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// 그리드 CSS 설정 함수
function setGridCSS() {
    // CSS 변수를 문서의 루트 요소에 설정
    document.documentElement.style.setProperty('--grid-rows', ROWS);
    document.documentElement.style.setProperty('--grid-cols', COLS);
    document.documentElement.style.setProperty('--cell-size', `${CELL_SIZE}px`);
    document.documentElement.style.setProperty('--grid-gap', `${GRID_GAP}px`);
    document.documentElement.style.setProperty('--grid-padding', `${GRID_PADDING}px`);
}

// 게임 초기화
function initGame() {
    // 그리드 CSS 설정
    setGridCSS();
    
    // 그리드 초기화
    grid = [];
    for (let i = 0; i < ROWS; i++) {
        const row = [];
        for (let j = 0; j < COLS; j++) {
            // 각 셀에 값, 레이어 깊이, 색상 정보 추가
            // 오른쪽 100개 셀은 파란색, 왼쪽 100개 셀은 주황색으로 시작
            const isRightHalf = j >= COLS / 2; // 오른쪽 절반 여부 확인
            row.push({
                value: Math.floor(Math.random() * 9) + 1, // 1부터 9까지 랜덤 숫자 생성
                layerDepth: isRightHalf ? 1 : 0, // 초기 레이어 깊이
                color: isRightHalf ? COLORS[1] : COLORS[0] // 오른쪽 절반은 파란색, 왼쪽 절반은 주황색
            });
        }
        grid.push(row);
    }
    
    // 그리드 렌더링
    renderGrid();
    
    // 게임 변수 초기화
    selectedCells = [];
    score = 0;
    timeLeft = GAME_TIME;
    emptyCellCount = 0;
    selectionStartCell = null;
    selectionEndCell = null;  // 선택 종료 셀 초기화
    maxLayerDepth = 0; // 최대 레이어 깊이 초기화
    
    // 힌트 관련 변수 초기화
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, HINT_DELAY);
    isHintVisible = false;
    cachedHints = null; // 힌트 캐시 초기화
    gameStateChanged = true; // 게임 상태 변경됨을 명시적으로 설정
    lastShownHintIndex = -1; // 힌트 인덱스도 초기화
    lastVisibleHint = null; // 이전 힌트 초기화
    secondLastVisibleHint = null; // 두 번째 이전 힌트 초기화
    
    // 누적 합 테이블 초기화
    buildAllPrefixSums();
    
    // UI 업데이트
    updateUI();
    
    // 타이머 시작
    clearInterval(gameTimer);
    gameTimer = setInterval(updateTimer, 100);
    
    // 게임 오버 화면 숨기기
    gameOverElement.style.display = 'none';
    
    // 힌트 미리 계산하기 - 상태 변경 후 즉시 실행하여 응답성 향상
    precomputeHints();
}

// 그리드 렌더링
function renderGrid() {
    gameGridElement.innerHTML = '';
    
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
            const cell = grid[i][j];
            const cellElement = document.createElement('div');
            cellElement.className = 'cell';
            cellElement.dataset.row = i;
            cellElement.dataset.col = j;
            
            if (cell && cell.value > 0) {
                cellElement.textContent = cell.value;
                
                // 레이어 색상 클래스 추가 
                cellElement.classList.add(`${cell.color}-layer`);
                
                // 셀 이벤트 추가
                cellElement.addEventListener('mousedown', startSelection);
                cellElement.addEventListener('mouseenter', updateSelection);
                cellElement.addEventListener('mouseup', endSelection);
            } else {
                cellElement.classList.add('empty');
                emptyCellCount++; // 비어있는 셀 카운트 증가
            }
            
            gameGridElement.appendChild(cellElement);
        }
    }
    
    // 글로벌 이벤트 리스너 추가
    document.addEventListener('mouseup', () => {
        if (isSelecting) endSelection();
    });
}

// 선택 시작
function startSelection(e) {
    if (timeLeft <= 0) return; // 애니메이션 체크 제거
    
    isSelecting = true;
    selectionStartCell = {
        row: parseInt(e.target.dataset.row),
        col: parseInt(e.target.dataset.col)
    };
    
    clearSelection();
    selectCellsInRange(selectionStartCell, selectionStartCell);
    
    // 전체 문서에 mousemove 이벤트 리스너 추가
    document.addEventListener('mousemove', updateSelectionFromPosition);
}

// 마우스 위치로부터 셀 좌표 계산
function getCellCoordinatesFromPosition(x, y) {
    const gridRect = gameGridElement.getBoundingClientRect();
    
    // 그리드 내 상대 위치 계산
    const relativeX = x - gridRect.left - GRID_PADDING; // 그리드 패딩 고려
    const relativeY = y - gridRect.top - GRID_PADDING;
    
    // 셀 좌표 계산
    let col = Math.floor(relativeX / (CELL_SIZE + GRID_GAP)); // 그리드 갭 고려
    let row = Math.floor(relativeY / (CELL_SIZE + GRID_GAP));
    
    // 유효한 범위로 제한
    col = Math.max(0, Math.min(col, COLS - 1));
    row = Math.max(0, Math.min(row, ROWS - 1));
    
    return { row, col };
}

// 마우스 위치에 따라 선택 영역 업데이트
function updateSelectionFromPosition(e) {
    if (!isSelecting || timeLeft <= 0) return; // 애니메이션 체크 제거
    
    const currentCell = getCellCoordinatesFromPosition(e.clientX, e.clientY);
    selectionEndCell = currentCell; // 선택 종료 셀 업데이트
    clearSelection();
    selectCellsInRange(selectionStartCell, currentCell);
}

// 선택 업데이트 (셀에서 직접 호출되는 경우)
function updateSelection(e) {
    if (!isSelecting || timeLeft <= 0) return; // 애니메이션 체크 제거
    
    const currentCell = {
        row: parseInt(e.target.dataset.row),
        col: parseInt(e.target.dataset.col)
    };
    
    selectionEndCell = currentCell; // 선택 종료 셀 업데이트
    clearSelection();
    selectCellsInRange(selectionStartCell, currentCell);
}

// 선택 종료
function endSelection() {
    if (!isSelecting || timeLeft <= 0) return; // 애니메이션 체크 제거
    
    isSelecting = false;
    
    // mousemove 이벤트 리스너 제거
    document.removeEventListener('mousemove', updateSelectionFromPosition);
    
    // 선택된 셀이 없으면 종료
    if (selectedCells.length === 0) {
        clearSelection();
        return;
    }
    
    // 선택된 셀의 색상 확인 (모두 같은 색상이어야 함)
    const selectionColor = selectedCells[0].color;
    const allSameColor = selectedCells.every(cell => cell.color === selectionColor);
    
    if (!allSameColor) {
        clearSelection();
        return;
    }
    
    // 합이 10인지 확인
    const sum = calculateSum();
    if (sum === TARGET_SUM) {
        // 선택 영역의 크기 계산
        const selectionWidth = currentSelectionSize.width;
        const selectionHeight = currentSelectionSize.height;
        
        // 점수 계산: (너비 + 높이 - 1) * 선택된 셀의 개수
        let multiplier = selectionWidth + selectionHeight - 1;
        
        // 힌트로 표시된 셀들을 그대로 선택했는지 확인
        let isUsingHint = isHintVisible && currentHint && currentHint.length === selectedCells.length ? currentHint.every(hintCell => 
            selectedCells.some(selectedCell => 
                hintCell.row === selectedCell.row && hintCell.col === selectedCell.col
            )
        ) : false;
        
        // 현재 표시 중이지 않지만 가장 최근에 표시된 힌트와 일치하는지 확인
        if (!isUsingHint && lastVisibleHint && lastVisibleHint.length === selectedCells.length) {
            isUsingHint = lastVisibleHint.every(hintCell => 
                selectedCells.some(selectedCell => 
                    hintCell.row === selectedCell.row && hintCell.col === selectedCell.col
                )
            );
            
            if (isUsingHint) {
                console.log("가장 최근에 보여진 힌트를 사용했습니다. 점수 배수가 1로 적용됩니다.");
            }
        }
        
        // 두 번째로 최근에 표시된 힌트와 일치하는지 확인
        if (!isUsingHint && secondLastVisibleHint && secondLastVisibleHint.length === selectedCells.length) {
            isUsingHint = secondLastVisibleHint.every(hintCell => 
                selectedCells.some(selectedCell => 
                    hintCell.row === selectedCell.row && hintCell.col === selectedCell.col
                )
            );
            
            if (isUsingHint) {
                console.log("두 번째로 최근에 보여진 힌트를 사용했습니다. 점수 배수가 1로 적용됩니다.");
            }
        }
        
        // 힌트를 사용했다면 배수를 1로 설정
        if (isUsingHint) {
            console.log("힌트를 사용했습니다. 점수 배수가 1로 적용됩니다.");
            multiplier = 1;
        }
        
        const pointsEarned = multiplier * selectedCells.length;
        
        // 애니메이션과 함께 선택된 셀의 레이어 밝히기
        revealNextLayerWithAnimation();
        
        score += pointsEarned;

        timeLeft += pointsEarned;
        console.log(`${pointsEarned} 점수 획득! ${pointsEarned}초 추가되었습니다.`);
        
        updateUI();
        
        // 마지막 클리어 시간 업데이트
        lastClearTime = Date.now();
        
        // 힌트가 표시 중이면 제거하고 타이머도 정리
        if (isHintVisible) {
            hideHint(false); // 타이머 재설정하지 않음
        }
        
        // 힌트 타이머 재설정 (기존 타이머 제거 후 한 번만 설정)
        clearTimeout(hintTimer);
        hintTimer = setTimeout(showHint, HINT_DELAY);
        return;
        
        // 게임 종료 조건은 나중에 추가할 수 있음 (예: 모든 셀이 특정 레이어에 도달)
    }
    clearSelection();
}

// 범위 내의 셀 선택 (같은 색상만 허용)
function selectCellsInRange(startCell, endCell) {
    selectedCells = [];
    
    const minRow = Math.min(startCell.row, endCell.row);
    const maxRow = Math.max(startCell.row, endCell.row);
    const minCol = Math.min(startCell.col, endCell.col);
    const maxCol = Math.max(startCell.col, endCell.col);
    
    // 시작 셀의 색상 확인
    const startCellColor = grid[startCell.row][startCell.col].color;
    
    // 선택 영역의 너비와 높이 계산
    const selectionWidth = maxCol - minCol + 1;
    const selectionHeight = maxRow - minRow + 1;
    // 현재 선택 영역의 정보를 저장
    currentSelectionSize = {
        width: selectionWidth,
        height: selectionHeight
    };
    
    for (let i = minRow; i <= maxRow; i++) {
        for (let j = minCol; j <= maxCol; j++) {
            // 셀이 존재하고, 값이 있고, 시작 셀과 색상이 같은 경우만 선택
            if (grid[i][j] && grid[i][j].value > 0 && grid[i][j].color === startCellColor) {
                const cellElement = document.querySelector(`.cell[data-row="${i}"][data-col="${j}"]`);
                cellElement.classList.add('selected');
                selectedCells.push({
                    row: i, 
                    col: j, 
                    value: grid[i][j].value,
                    color: grid[i][j].color,
                    layerDepth: grid[i][j].layerDepth
                });
            }
        }
    }
    
    updateUI();
}

// 선택 해제
function clearSelection() {
    document.querySelectorAll('.cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    selectedCells = [];
    updateUI();
}

// 선택된 셀의 합 계산
function calculateSum() {
    return selectedCells.reduce((sum, cell) => sum + cell.value, 0);
}

// 다음 레이어 표시 (애니메이션 적용)
function revealNextLayerWithAnimation() {
    if (selectedCells.length === 0) return;
    
    // 애니메이션 카운터
    let animationCount = 0;
    const totalCells = selectedCells.length;
    
    // 게임 상태 변경 표시 (힌트 캐시 무효화)
    gameStateChanged = true;
    cachedHints = null;
    lastShownHintIndex = -1; // 힌트 인덱스도 초기화
    lastVisibleHint = null; // 이전 힌트도 초기화
    secondLastVisibleHint = null; // 두 번째 이전 힌트도 초기화
    
    // 선택된 셀들의 복사본 생성
    const cellsToReveal = [...selectedCells];
    
    // 선택 방향 확인 (애니메이션 순서를 위해)
    if (selectionStartCell && selectionEndCell) {
        // 가로 방향 (왼쪽->오른쪽 또는 오른쪽->왼쪽)
        const isRightToLeft = selectionEndCell.col < selectionStartCell.col;
        
        // 세로 방향 (위->아래 또는 아래->위)
        const isBottomToTop = selectionEndCell.row < selectionStartCell.row;
        
        // 가로와 세로 중 어느 방향으로 더 많이 움직였는지 계산
        const horizontalDistance = Math.abs(selectionEndCell.col - selectionStartCell.col);
        const verticalDistance = Math.abs(selectionEndCell.row - selectionStartCell.row);
        const isPrimarilyHorizontal = horizontalDistance >= verticalDistance;
        
        // 선택 방향에 따라 셀 정렬
        cellsToReveal.sort((a, b) => {
            // 가로 방향이 주요 방향이면 (가로 변화가 세로 변화보다 크거나 같은 경우)
            if (isPrimarilyHorizontal) {
                // 왼쪽에서 오른쪽으로 또는 오른쪽에서 왼쪽으로 정렬
                const colCompare = isRightToLeft ? b.col - a.col : a.col - b.col;
                // 열이 같을 경우 행으로 비교 (위에서 아래로 또는 아래에서 위로)
                return colCompare === 0 ? (isBottomToTop ? b.row - a.row : a.row - b.row) : colCompare;
            } 
            // 세로 방향이 주요 방향이면
            else {
                // 위에서 아래로 또는 아래에서 위로 정렬
                const rowCompare = isBottomToTop ? b.row - a.row : a.row - b.row;
                // 행이 같을 경우 열로 비교 (왼쪽에서 오른쪽으로 또는 오른쪽에서 왼쪽으로)
                return rowCompare === 0 ? (isRightToLeft ? b.col - a.col : a.col - b.col) : rowCompare;
            }
        });
        
        console.log(`선택 방향: ${isRightToLeft ? '오른쪽->왼쪽' : '왼쪽->오른쪽'}, ${isBottomToTop ? '아래->위' : '위->아래'}, 주요 방향: ${isPrimarilyHorizontal ? '가로' : '세로'}`);
    }
    
    // 셀을 하나씩 애니메이션으로 레이어 변경
    cellsToReveal.forEach((cell, index) => {
        setTimeout(() => {
            // 그리드 데이터에서 현재 셀 정보 확인
            const currentCell = grid[cell.row][cell.col];
            
            // 현재 셀의 DOM 요소 찾기
            const cellElement = document.querySelector(`.cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
            
            if (!(cellElement && currentCell)) {
                return;
            }
            // 실제 위치에 셀을 고정 (애니메이션용 복제본을 위해)
            const rect = cellElement.getBoundingClientRect();
            const gridRect = gameGridElement.getBoundingClientRect();
                
            // 클론 생성 (사라지는 애니메이션용)
            const cellClone = cellElement.cloneNode(true);
            cellClone.style.position = 'absolute';
            cellClone.style.left = `${rect.left - gridRect.left}px`;
            cellClone.style.top = `${rect.top - gridRect.top}px`;
            cellClone.classList.add('falling');
            gameGridElement.appendChild(cellClone);
                
            // 레이어 깊이 증가
            const newLayerDepth = currentCell.layerDepth + 1;
            maxLayerDepth = Math.max(maxLayerDepth, newLayerDepth);
                
            // 새 레이어 색상 결정 (교대로 주황/파랑)
            const newColor = COLORS[newLayerDepth % COLORS.length];
                
            // Feistel 암호화로 새 값 생성
            // 위치를 하나의 숫자로 변환: position = row * COLS + col
            const position = cell.row * COLS + cell.col;
            const newValue = (pseudoPermutation(200, position, 4, newLayerDepth) % 9) + 1; // 1~9 범위
                
            // 그리드 데이터 업데이트
            grid[cell.row][cell.col] = {
                value: newValue,
                layerDepth: newLayerDepth,
                color: newColor
            };
                
            // DOM 요소 업데이트
            cellElement.textContent = newValue;
                
            // 색상 클래스 업데이트
            cellElement.classList.remove('orange-layer', 'blue-layer');
            cellElement.classList.add(`${newColor}-layer`);
                
            // 물리 애니메이션 파라미터
            const physics = {
                // 발사 각도: 45~135도 사이 (위쪽 방향)
                angle: (45 + Math.random() * 90) * Math.PI / 180,
                // 초기 속도: 200~300 픽셀/초
                initialSpeed: 200 + Math.random() * 100,
                // 회전 속도: -360~360도/초
                rotationSpeed: -360 + Math.random() * 720,
                // 중력 가속도: 980 픽셀/초^2 (물리학적 중력과 유사)
                gravity: 980,
                // 애니메이션 지속 시간: 0.8~1.2초
                duration: 400 + Math.random() * 400,
                // 타임스탬프 초기화
                startTime: null,
                // 위치 및 회전 추적
                x: 0,
                y: 0,
                rotation: 0,
                opacity: 1,
                element: cellClone
            };
                
            // 애니메이션 시작
            startPhysicsAnimation(physics, () => {
                cellClone.remove();
                animationCount++;
                    
                // 모든 애니메이션이 끝나면
                if (animationCount !== totalCells) {
                    return;
                }
                // 누적 합 테이블 업데이트
                buildAllPrefixSums();
                        
                // 힌트 미리 계산
                precomputeHints();
                        
                // 게임 종료 조건 확인
                checkGameCompletion();
            });
        }, index * 50); // 각 셀마다 약간의 지연 시간
    });
    
    // 선택 해제
    clearSelection();
}

// 특정 셀 값 변경 시 누적 합 테이블 업데이트 (점진적 업데이트)
function updatePrefixSum(prefixSum, row, col, oldValue, newValue) {
    // 그리드에서 0 이하의 값은 합계에 포함되지 않으므로 실제 계산 값 조정
    const actualOldValue = oldValue && oldValue.value > 0 ? oldValue.value : 0;
    const actualNewValue = newValue && newValue.value > 0 ? newValue.value : 0;
    
    // 변경된 차이 계산
    const diff = actualNewValue - actualOldValue;
    
    // 변경이 없으면 업데이트 필요 없음
    if (diff === 0) return;
    
    // 영향 받는 누적 합 영역만 업데이트 (row+1, col+1부터 끝까지)
    for (let i = row + 1; i <= ROWS; i++) {
        for (let j = col + 1; j <= COLS; j++) {
            prefixSum[i][j] += diff;
        }
    }
}

// 누적 합 테이블 구축 - 색상별로 구분하여 생성
function buildAllPrefixSums() {
    console.time("모든 PrefixSum 테이블 구축");
    
    // 일반 누적 합 테이블 (색상 구분 없이)
    prefixSumTable = buildPrefixSum(grid, ROWS, COLS, null);
    
    // 색상별 누적 합 테이블
    orangePrefixSumTable = buildPrefixSum(grid, ROWS, COLS, 'orange');
    bluePrefixSumTable = buildPrefixSum(grid, ROWS, COLS, 'blue');
    
    console.timeEnd("모든 PrefixSum 테이블 구축");
}

// 누적 합 테이블(Prefix Sum) 구축 - 특정 색상에 대한 누적 합 계산
function buildPrefixSum(grid, ROWS, COLS, color) {
    console.time(`PrefixSum 테이블 구축 (${color || 'all'})`);
    // 크기를 1 더 크게 해서 경계 조건 처리를 간단히 함
    const prefixSum = Array(ROWS + 1).fill().map(() => Array(COLS + 1).fill(0));
    
    // 모든 셀에 대해 누적 합 계산
    for (let i = 1; i <= ROWS; i++) {
        for (let j = 1; j <= COLS; j++) {
            // 현재 셀이 유효한지 확인 (값이 있고, 색상이 일치하거나 색상 필터가 없는 경우)
            const cell = grid[i-1][j-1];
            const cellValue = cell && cell.value > 0 && (!color || cell.color === color) ? cell.value : 0;
            
            // 현재 셀 값 + 왼쪽까지의 합 + 위쪽까지의 합 - 중복 계산된 왼쪽 위 대각선 영역
            prefixSum[i][j] = cellValue + 
                             prefixSum[i-1][j] + 
                             prefixSum[i][j-1] - 
                             prefixSum[i-1][j-1];
        }
    }
    console.timeEnd(`PrefixSum 테이블 구축 (${color || 'all'})`);
    return prefixSum;
}

// 누적 합 테이블에서 직사각형 영역의 합을 계산
function getRectangleSum(prefixSum, r1, c1, r2, c2) {
    // 직사각형 영역 합 계산 - O(1) 시간 복잡도
    return prefixSum[r2+1][c2+1] - prefixSum[r2+1][c1] - prefixSum[r1][c2+1] + prefixSum[r1][c1];
}

// 직사각형 영역이 유효한지 확인 (색상 고려)
function isValidRectangle(grid, r1, c1, r2, c2) {
    // 적어도 하나의 셀이 존재하는지 확인
    let hasCell = false;
    
    // 첫 번째 유효한 셀 색상 확인 (모든 셀은 같은 색이어야 함)
    let firstCellColor = null;
    
    // 합계 및 유효한 셀 카운트 초기화
    let validCellCount = 0;
    let sum = 0;
    
    for (let i = r1; i <= r2; i++) {
        for (let j = c1; j <= c2; j++) {
            // 셀이 존재하고 값이 있는 경우
            if (grid[i][j] && grid[i][j].value > 0) {
                hasCell = true;
                
                // 첫 번째 색상 설정 또는 확인
                if (firstCellColor === null) {
                    firstCellColor = grid[i][j].color;
                } 
                // 다른 색상 셀이 있으면 유효하지 않음
                else if (grid[i][j].color !== firstCellColor) {
                    return false;
                }
                
                validCellCount++;
                sum += grid[i][j].value;
                
                // 합이 이미 목표값을 초과하면 바로 유효하지 않음
                if (sum > TARGET_SUM) {
                    return false;
                }
            }
        }
    }
    
    // 2개 이상의 유효한 셀이 있고, 합이 목표값과 일치하는지 확인
    return hasCell && validCellCount >= 2 && sum === TARGET_SUM;
}


// 영역이 이미 힌트 목록에 있는지 확인 (중복 검사)
function isDuplicateHint(hints, cells) {
    return hints.some(hint => 
        hint.length === cells.length && 
        hint.every(cell => 
            cells.some(c => c.row === cell.row && c.col === cell.col)
        )
    );
}

// 힌트 검색 - 합이 TARGET_SUM이 되는 영역 찾기 (효율적인 누적 합 테이블 사용)
function findHints() {
    // 게임 상태가 변경되지 않았고 캐시된 힌트가 있으면 재사용
    if (!gameStateChanged && cachedHints && cachedHints.length > 0) {
        console.log(`게임 상태가 변경되지 않아 캐시된 힌트(${cachedHints.length}개)를 재사용합니다.`);
        return cachedHints;
    }
    
    console.time("힌트 검색 (PrefixSum)");
    console.log(`게임 상태가 변경되어 새로운 힌트를 계산합니다...`);
    const hints = [];
    
    // 누적 합 테이블 구축 또는 업데이트
    if (!prefixSumTable || !orangePrefixSumTable || !bluePrefixSumTable) {
        console.log("누적 합 테이블 새로 구축");
        buildAllPrefixSums();
    } else {
        console.log("기존 누적 합 테이블 사용");
    }
    
    // 색상별로 힌트 찾기
    for (const color of COLORS) {
        // 색상에 맞는 누적 합 테이블 선택
        const colorPrefixSum = color === 'orange' ? orangePrefixSumTable : bluePrefixSumTable;
        
        // 빈 셀이 아니고 현재 색상과 일치하는 셀 정보 수집
        const validCells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] && grid[r][c].value > 0 && grid[r][c].color === color) {
                    validCells.push({row: r, col: c});
                }
            }
        }
        
        console.log(`${color} 색상의 유효한 셀 ${validCells.length}개를 사용하여 힌트를 검색합니다.`);
        
        // 각 유효한 셀을 탐색하여 가능한 직사각형 영역 찾기
        for (let i = 0; i < validCells.length; i++) {
            const startCell = validCells[i];
            
            for (let j = i; j < validCells.length; j++) {
                const endCell = validCells[j];
                
                // 유효한 직사각형 영역 좌표 계산
                const r1 = Math.min(startCell.row, endCell.row);
                const c1 = Math.min(startCell.col, endCell.col);
                const r2 = Math.max(startCell.row, endCell.row);
                const c2 = Math.max(startCell.col, endCell.col);
                
                // 직사각형 영역의 합을 효율적으로 계산
                const sum = getRectangleSum(colorPrefixSum, r1, c1, r2, c2);
                
                // 합이 목표값과 일치하는지 확인
                if (sum === TARGET_SUM) {
                    // 직사각형 영역 내의 현재 색상과 일치하는 셀들 수집
                    const rectCells = [];
                    for (let r = r1; r <= r2; r++) {
                        for (let c = c1; c <= c2; c++) {
                            if (grid[r][c] && grid[r][c].value > 0 && grid[r][c].color === color) {
                                rectCells.push({
                                    row: r, 
                                    col: c, 
                                    value: grid[r][c].value,
                                    color: grid[r][c].color
                                });
                            }
                        }
                    }
                    
                    // 최소 2개 이상의 셀이 있어야 유효한 힌트
                    if (rectCells.length >= 2 && !isDuplicateHint(hints, rectCells)) {
                        hints.push(rectCells);
                    }
                }
            }
        }
    }
    
    console.log(`PrefixSum 방식으로 ${hints.length}개의 가능한 힌트를 찾았습니다.`);
    console.timeEnd("힌트 검색 (PrefixSum)");
    
    // 게임 상태가 변경되었으므로 새로운 힌트를 캐시에 저장
    cachedHints = [...hints];
    gameStateChanged = false;
    console.log(`힌트 ${hints.length}개를 캐시에 저장했습니다. 다음에 재사용할 수 있습니다.`);
    
    return hints;
}


// 힌트 표시
function showHint() {
    // 게임 종료 상태면 힌트 표시 안 함
    if (timeLeft <= 0) {
        return;
    }
    
    // 타이머 초기화 (중요: 자기 자신을 다시 호출하는 타이머가 중첩되지 않도록)
    clearTimeout(hintTimer);
    hintTimer = null;
    
    // 이미 힌트가 표시 중이면 제거
    if (isHintVisible) {
        hideHint(false); // 타이머 재설정하지 않음
    }
    
    // 새로운 힌트 세트를 가져올 때마다 인덱스 초기화 (다양한 힌트 표시를 위해)
    if (gameStateChanged) {
        lastShownHintIndex = -1;
    }
    
    // 힌트 계산 (캐시 활용)
    const hints = findHints();
    
    // 힌트가 없으면 즉시 종료하고 새 타이머도 설정하지 않음
    if (hints.length === 0) {
        console.log("힌트를 찾을 수 없습니다. 더 이상 가능한 조합이 없습니다.");
        return;
    }
    
    console.log(`${hints.length}개의 힌트 중에서 표시할 힌트를 선택합니다.`);
    
    // 힌트 랜덤하게 선택 (이전과 다른 힌트)
    const randomIndex = getRandomDifferentHintIndex(hints.length);
    currentHint = hints[randomIndex];
    lastShownHintIndex = randomIndex; // 현재 표시된 힌트 인덱스 저장
    showCurrentHint();
    
    // 일정 시간 후 힌트 제거
    clearTimeout(hintTimer); // 기존 타이머 제거 (중요)
    hintTimer = setTimeout(() => hideHint(true), HINT_DURATION);
}

// 이전과 다른 랜덤 힌트 인덱스 가져오기
function getRandomDifferentHintIndex(hintsLength) {
    // 힌트가 없거나 하나뿐이면 그냥 0 반환
    if (hintsLength <= 0) return -1;
    if (hintsLength === 1) return 0;
    
    // 이전 힌트와 다른 새 인덱스 선택
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * hintsLength);
    } while (newIndex === lastShownHintIndex);
    
    return newIndex;
}

// 선택된 힌트 표시
function showCurrentHint() {
    if (!currentHint) return;
    
    // 추가 유효성 검사 - 힌트를 표시하기 전에 모든 셀이 유효한지 확인
    const allValid = currentHint.every(cell => 
        cell.row >= 0 && cell.row < ROWS && 
        cell.col >= 0 && cell.col < COLS && 
        grid[cell.row][cell.col] && grid[cell.row][cell.col].value > 0
    );
    
    if (!allValid) {
        console.log("힌트 셀 중 일부가 현재 그리드에 유효하지 않음");
        // 유효하지 않은 힌트는 표시하지 않고 다른 힌트 요청
        clearTimeout(hintTimer);
        hintTimer = setTimeout(showHint, 100); // 즉시 새 힌트 탐색
        return;
    }
    
    // 이전 힌트 요소들 모두 제거 (안전 장치)
    document.querySelectorAll('.cell.hint').forEach(cell => {
        cell.classList.remove('hint');
    });
    
    // 새 힌트 표시
    currentHint.forEach(cell => {
        const cellElement = document.querySelector(`.cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
        if (cellElement && !cellElement.classList.contains('empty')) {
            cellElement.classList.add('hint');
        } else {
            console.log(`Invalid hint cell at ${cell.row},${cell.col}`);
        }
    });
    
    isHintVisible = true;
    
    // 일정 시간 후 힌트 제거
    clearTimeout(hintTimer); // 기존 타이머 제거 (중요)
    hintTimer = setTimeout(() => hideHint(true), HINT_DURATION);
}

// 힌트 제거
function hideHint(resetTimer = true) {
    // 현재 힌트를 이전 힌트들로 이동
    if (currentHint) {
        // 두 번째 최근 힌트에 가장 최근 힌트 저장
        secondLastVisibleHint = lastVisibleHint ? [...lastVisibleHint] : null;
        // 가장 최근 힌트에 현재 힌트 저장
        lastVisibleHint = [...currentHint];
    }
    
    // 모든 힌트 셀 클래스 제거 (안전성 향상)
    document.querySelectorAll('.cell.hint').forEach(cell => {
        cell.classList.remove('hint');
    });
    
    // 상태 초기화
    currentHint = null;
    isHintVisible = false;
    
    // 타이머 재설정 (필요한 경우에만)
    if (resetTimer) {
        clearTimeout(hintTimer);
        hintTimer = setTimeout(showHint, HINT_DELAY);
    }
}

// 물리 기반 애니메이션 시작
function startPhysicsAnimation(physics, onComplete) {
    // 애니메이션 시작 시간 기록
    physics.startTime = performance.now();
    
    // 애니메이션 함수
    function animate(timestamp) {
        // 경과 시간 계산 (초 단위)
        const elapsed = (timestamp - physics.startTime) / 1000;
        
        // 애니메이션 지속 시간을 초과하면 종료
        if (elapsed >= physics.duration / 1000) {
            onComplete();
            return;
        }
        
        // 초기 속도 분해
        const vx = physics.initialSpeed * Math.cos(physics.angle);
        const vy = -physics.initialSpeed * Math.sin(physics.angle); // 위쪽이 음수 방향
        
        // 포물선 운동 계산
        physics.x = vx * elapsed;
        physics.y = vy * elapsed + 0.5 * physics.gravity * elapsed * elapsed;
        
        // 회전 계산
        physics.rotation = physics.rotationSpeed * elapsed;
        
        // 투명도 계산 (후반부에 더 빠르게 투명해짐)
        const normalizedTime = elapsed / (physics.duration / 1000);
        physics.opacity = normalizedTime < 0.7 ? 1 : 1 - ((normalizedTime - 0.7) / 0.3);
        
        // 스타일 적용
        physics.element.style.transform = `translate(${physics.x}px, ${physics.y}px) rotate(${physics.rotation}deg)`;
        physics.element.style.opacity = physics.opacity;
        
        // 다음 프레임 요청
        requestAnimationFrame(animate);
    }
    
    // 애니메이션 시작
    requestAnimationFrame(animate);
}


// UI 업데이트
function updateUI() {
    sumElement.textContent = calculateSum();
    scoreElement.textContent = score;
    timeElement.textContent = timeLeft.toFixed(1);
}

// 타이머 업데이트
function updateTimer() {
    timeLeft -= 0.1;
    updateUI();
    
    if (timeLeft <= 0) {
        clearInterval(gameTimer);
        endGame(false);
    }
}

// 게임 종료
function endGame(isWin) {
    clearInterval(gameTimer);
    clearTimeout(hintTimer); // 힌트 타이머 정리
    
    resultMessageElement.textContent = isWin ? '축하합니다! 모든 레이어를 파헤쳤습니다!' : '시간 초과! 게임 종료';
    
    finalScoreElement.textContent = score;
    gameOverElement.style.display = 'flex';
}

// 레이어 게임 종료 조건 확인 - 모든 셀이 특정 레이어 이상이 되면 게임 승리
function checkGameCompletion() {
    const TARGET_LAYER = 5; // 목표 레이어 깊이 (조정 가능)
    
    // 최대 레이어 깊이가 목표 레이어에 도달했는지 확인
    if (maxLayerDepth >= TARGET_LAYER) {
        // 모든 셀이 최소한 TARGET_LAYER 레이어에 도달했는지 확인
        let allCellsReachedTarget = true;
        
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                if (!grid[i][j] || grid[i][j].layerDepth < TARGET_LAYER) {
                    allCellsReachedTarget = false;
                    break;
                }
            }
            if (!allCellsReachedTarget) break;
        }
        
        if (allCellsReachedTarget) {
            endGame(true);
            return true;
        }
    }
    
    return false;
}

// 이벤트 리스너
restartBtn.addEventListener('click', initGame);

// 로컬호스트 감지 함수
function isLocalhost() {
    // 파일 프로토콜 확인 (file://)
    if (location.protocol === 'file:') {
        return true;
    }
    
    const hostname = location.hostname;
    
    // 로컬호스트 도메인 확인
    if (hostname === 'localhost' || 
        hostname === '' || 
        hostname.endsWith('.localhost') || 
        hostname.endsWith('.local')) {
        return true;
    }
    
    // IPv4 로컬호스트/내부망 확인
    if (hostname === '127.0.0.1' || 
        hostname.match(/^127\.(\d+)\.(\d+)\.(\d+)$/) !== null || 
        hostname.startsWith('10.') || 
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\.(\d+)\.(\d+)$/) !== null || 
        hostname.match(/^192\.168\.(\d+)\.(\d+)$/) !== null || 
        hostname.match(/^169\.254\.(\d+)\.(\d+)$/) !== null) {
        return true;
    }
    
    // IPv6 로컬호스트 확인
    if (hostname === '::1' || 
        hostname === '[::1]' || 
        hostname.toLowerCase().startsWith('fe80:') || // 링크 로컬 (fe80::/10)
        hostname.toLowerCase().startsWith('fc00:') || // 유니크 로컬 fc00::/8 
        hostname.toLowerCase().startsWith('fd00:') || // 유니크 로컬 fd00::/8
        hostname.toLowerCase().match(/^f[cd][0-9a-f]{2}:/i) !== null) { // ULA fc00::/7 범위 전체
        return true;
    }
    
    return false;
}

// 힌트 미리 계산하기 - 상태 변경 후 즉시 실행하여 응답성 향상
function precomputeHints() {
    console.log("게임 상태 변경 감지 - 힌트 미리 계산 시작");
    // 이미 게임 상태가 변경된 상태로 설정
    gameStateChanged = true;
    
    // 힌트 계산 및 캐시 업데이트 - 백그라운드에서 처리하여 UI 응답성 유지
    setTimeout(() => {
        const startTime = performance.now();
        const hints = findHints();
        const endTime = performance.now();
        console.log(`힌트 선제 계산 완료: ${hints.length}개 힌트, 소요 시간: ${(endTime - startTime).toFixed(2)}ms`);
    }, 0);
}

// 게임 시작
initGame();