import { pseudoPermutation } from './feistel.min.js';

const noop = () => {};
const IS_LOCALHOST = isLocalhost();
Object.entries(console).forEach(([name, value]) => {
    if (typeof value === 'function') {
        const wrappedFunction = new Proxy(value, {
            apply(target, thisArg, argumentsList) {
                const fn = IS_LOCALHOST ? target : noop;
                return Reflect.apply(fn, thisArg, argumentsList);
            }
        })
        console[name+'_'] = value;
        console[name] = wrappedFunction;
    }
})

// 게임 변수 초기화
const aspect = screen.availWidth / screen.availHeight;
const ROWS = aspect > 1 ? 5 : 10;
const COLS = aspect > 1 ? 10 : 5;
const TARGET_SUM = 10;
const TIME_LIMIT = 100;
const CELL_SIZE = 36; // 셀 크기(픽셀)
const GRID_GAP = 4;   // 그리드 셀 간격(픽셀)
const GRID_PADDING = 4; // 그리드 패딩(픽셀)
const HINT_DELAY = 5000; // 힌트가 표시되기까지의 시간(ms)
const HINT_DURATION = 3000; // 힌트 표시 지속 시간(ms)
const POINTER_TYPE_TOUCH = 'touch'; // 포인터 타입: 터치

let grid = [];
let selectedCells = [];
let score = 0;
let timeLeft = TIME_LIMIT;
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

// 누적 합 테이블을 전역 변수로 저장 (그리드 상태 변화에 따라 점진적으로 업데이트)
let prefixSumTable = null;
// 색상별 누적 합 테이블 (주황색/파란색 각각)
let orangePrefixSumTable = null;
let bluePrefixSumTable = null;

// DOM 요소
let gameGridElement = document.getElementById('game-grid');
let timeElement = document.getElementById('time');
let scoreElement = document.getElementById('score');
let sumElement = document.getElementById('sum');
let gameOverElement = document.getElementById('game-over');
let resultMessageElement = document.getElementById('result-message');
let gameEndReasonElement = document.getElementById('game-end-reason');
let finalScoreElement = document.getElementById('final-score');
let restartBtn = document.getElementById('restart-btn');

// 캐시된 DOM 요소들 - 성능 최적화를 위해 사용
let cellElements = {}; // 셀 요소 캐시 저장소

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
            // 오른쪽 절반은 파란색, 왼쪽 절반은 주황색으로 시작
            const isRightHalf = aspect > 1 ? j >= COLS / 2 : i >= ROWS / 2; // 오른쪽 절반 여부 확인
            
            row.push({
                value: Math.floor(generateBenfordNumber()), // 1부터 9까지 랜덤 숫자 생성
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
    timeLeft = TIME_LIMIT;
    emptyCellCount = 0;
    selectionStartCell = null;
    selectionEndCell = null;  // 선택 종료 셀 초기화
    
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

// DOM 초기화 및 게임 오버 화면 생성
function initDom() {
    // 게임 그리드 요소 참조
    gameGridElement = document.getElementById('game-grid');
    
    // 게임 정보 UI 요소
    timeElement = document.getElementById('time');
    scoreElement = document.getElementById('score');
    sumElement = document.getElementById('sum');
    
    // 게임 오버 화면 요소
    gameOverElement = document.getElementById('game-over');
    resultMessageElement = document.getElementById('result-message');
    gameEndReasonElement = document.getElementById('game-end-reason');
    finalScoreElement = document.getElementById('final-score');
    restartBtn = document.getElementById('restart-btn');
    
    // 이벤트 리스너 설정
    restartBtn.addEventListener('click', initGame);
    
    // 그리드 이벤트 리스너 설정 - 포인터 이벤트만 사용
    gameGridElement.addEventListener('pointerdown', startSelection);
    gameGridElement.addEventListener('pointermove', updateSelection);
    gameGridElement.addEventListener('pointerup', endSelection);
    gameGridElement.addEventListener('pointercancel', endSelection);
    gameGridElement.addEventListener('pointerleave', endSelection);
}

// 페이지 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', () => {
    initDom();
    initGame();
});

// 그리드 렌더링
function renderGrid() {
    gameGridElement.innerHTML = '';
    
    // DOM 요소 캐시 초기화
    cellElements = {};
    
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
            const cell = grid[i][j];
            const cellElement = document.createElement('div');
            cellElement.className = 'cell';
            cellElement.dataset.row = i;
            cellElement.dataset.col = j;
            
            // 셀 요소 캐싱 (성능 최적화)
            const cellId = `${i}-${j}`;
            cellElements[cellId] = cellElement;
            
            if (cell && cell.value > 0) {
                cellElement.textContent = cell.value;
                
                // 레이어 색상 클래스 추가 
                cellElement.classList.add(`${cell.color}-layer`);
                
                // 개별 셀에 이벤트 리스너 추가하지 않음
                // (그리드 레벨 포인터 이벤트만 사용)
            } else {
                cellElement.classList.add('empty');
                emptyCellCount++; // 비어있는 셀 카운트 증가
            }
            
            gameGridElement.appendChild(cellElement);
        }
    }
}

// 선택 시작
function startSelection(e) {
    if (timeLeft <= 0) return;
    
    isSelecting = true;
    
    // 포인터 캡처 설정 (드래그 추적 개선) - 터치 입력에만 적용
    if (e.pointerType === POINTER_TYPE_TOUCH && e.target.hasPointerCapture && e.pointerId) {
        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (error) {
            console.warn('포인터 캡처 설정 실패:', error);
        }
    }
    
    // 셀 좌표 계산
    const targetElement = e.target;
    selectionStartCell = targetElement.classList.contains('cell') ? {
        row: parseInt(targetElement.dataset.row, 10),
        col: parseInt(targetElement.dataset.col, 10)
    } : getCellCoordinatesFromPosition(e.clientX, e.clientY);
    
    clearSelection();
    selectCellsInRange(selectionStartCell, selectionStartCell);
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

// 포인터 이동에 따른 선택 영역 업데이트 (pointermove 이벤트 핸들러)
function updateSelection(e) {
    if (!isSelecting || timeLeft <= 0) return;
    
    // 셀 좌표 계산 (효율적인 방식)
    const currentCell = getCellCoordinatesFromPosition(e.clientX, e.clientY);
    
    // 셀 위치가 변경된 경우만 업데이트 - 불필요한 DOM 업데이트 방지
    if (!selectionEndCell || 
        currentCell.row !== selectionEndCell.row || 
        currentCell.col !== selectionEndCell.col) {
        
        selectionEndCell = currentCell;
        selectCellsInRange(selectionStartCell, currentCell);
    }
}

// 선택 종료
function endSelection(e) {
    if (!isSelecting || timeLeft <= 0) return;
    
    isSelecting = false;
    
    // 포인터 캡처 해제 - 터치 입력 및 유효한 이벤트에만 적용
    if (e && e.pointerType === POINTER_TYPE_TOUCH && e.pointerId && 
        e.target && e.target.hasPointerCapture) {
        try {
            // hasPointerCapture 메서드가 존재하고 해당 포인터가 캡처된 경우에만 해제
            if (typeof e.target.hasPointerCapture === 'function' && 
                e.target.hasPointerCapture(e.pointerId)) {
                e.target.releasePointerCapture(e.pointerId);
            }
        } catch (error) {
            console.warn('포인터 캡처 해제 실패:', error);
        }
    }
    
    // 선택된 셀이 없으면 종료
    if (!selectedCells || selectedCells.length === 0) {
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
    // 범위 계산
    const minRow = Math.min(startCell.row, endCell.row);
    const maxRow = Math.max(startCell.row, endCell.row);
    const minCol = Math.min(startCell.col, endCell.col);
    const maxCol = Math.max(startCell.col, endCell.col);
    
    // 시작 셀의 색상 확인
    const startCellColor = grid[startCell.row][startCell.col].color;
    
    // 선택 영역의 너비와 높이 계산
    const selectionWidth = maxCol - minCol + 1;
    const selectionHeight = maxRow - minRow + 1;
    currentSelectionSize = {
        width: selectionWidth,
        height: selectionHeight
    };
    
    // 현재 선택될 셀과 이전에 선택된 셀의 차이 계산
    const newSelectedIds = new Set();
    const newSelectedCells = [];
    
    // 새로 선택될 셀 식별
    for (let i = minRow; i <= maxRow; i++) {
        for (let j = minCol; j <= maxCol; j++) {
            // 유효한 셀이고 같은 색상인지 확인
            if (grid[i][j] && grid[i][j].value > 0 && grid[i][j].color === startCellColor) {
                const cellId = `${i}-${j}`;
                newSelectedIds.add(cellId);
                
                // 선택된 셀 정보 추가
                newSelectedCells.push({
                    row: i, 
                    col: j, 
                    value: grid[i][j].value,
                    color: grid[i][j].color,
                    layerDepth: grid[i][j].layerDepth
                });
            }
        }
    }
    
    // 이전에 선택된 셀 중 선택 취소해야 할 셀 식별
    const currentSelectedIds = selectedCells.map(cell => `${cell.row}-${cell.col}`);
    
    // 1. 이전에 선택된 셀 중 선택 취소해야 할 셀 선택 해제
    for (const id of currentSelectedIds) {
        if (!newSelectedIds.has(id)) {
            const cell = cellElements[id];
            if (cell) {
                cell.classList.remove('selected');
            }
        }
    }
    
    // 2. 새로 선택해야 할 셀 선택 추가
    for (const id of newSelectedIds) {
        if (!currentSelectedIds.includes(id)) {
            const cell = cellElements[id];
            if (cell) {
                cell.classList.add('selected');
            }
        }
    }
    
    // 선택된 셀 목록 업데이트
    selectedCells = newSelectedCells;
    
    // 합계 계산하여 UI 업데이트
    updateUI();
}

// 선택 해제
function clearSelection() {
    // 선택된 셀이 없으면 불필요한 작업 방지
    if (selectedCells.length === 0) return;
    
    // 선택된 모든 셀에서 선택 클래스 제거
    for (const cell of selectedCells) {
        const cellId = `${cell.row}-${cell.col}`;
        const cellElement = cellElements[cellId];
        if (cellElement) {
            cellElement.classList.remove('selected');
        }
    }
    
    // 선택된 셀 배열 초기화
    selectedCells = [];
    
    // UI 업데이트
    updateUI();
}

// 선택된 셀의 합 계산
function calculateSum() {
    return selectedCells.reduce((sum, cell) => sum + cell.value, 0);
}

// 다음 레이어 표시 (애니메이션 적용)
function revealNextLayerWithAnimation() {
    if (selectedCells.length === 0) return;
    
    // 현재 남은 힌트의 수 파악
    const hints = findHints();
    const hintsCount = hints.length;
    
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
        // 그리드 데이터에서 현재 셀 정보 확인
        const currentCell = grid[cell.row][cell.col];
        // 레이어 깊이 증가
        const newLayerDepth = currentCell.layerDepth + 1;
            
        // 새 레이어 색상 결정 (교대로 주황/파랑)
        const newColor = COLORS[newLayerDepth % COLORS.length];
        
        // 남은 힌트 수에 따라 1/sqrt(hintsCount) 확률로 벤포드 법칙 사용
        let newValue;
        
        // 힌트가 적을수록 벤포드 법칙을 사용할 확률 증가
        // hintsCount가 0이면 무조건 벤포드 법칙 사용 (게임 진행을 위해)
        const useBenfordProbability = hintsCount <= 1 ? 1 : 1 / Math.sqrt(hintsCount);
        
        if (Math.random() < useBenfordProbability) {
            // 벤포드 법칙 사용
            newValue = generateBenfordNumber();
            console.log(`벤포드 법칙 적용 (힌트 수: ${hintsCount}, 확률: ${(useBenfordProbability * 100).toFixed(2)}%) - 생성된 값: ${newValue}`);
        } else {
            // 기존 방식 사용
            const position = cell.row * COLS + cell.col;
            newValue = (pseudoPermutation(200*9, position, 4, newLayerDepth) % 9) + 1; // 1~9 범위
        }
            
        // 그리드 데이터 업데이트
        grid[cell.row][cell.col] = {
            value: newValue,
            layerDepth: newLayerDepth,
            color: newColor
        };
        
        setTimeout(() => {
            
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
            cellClone.style.position = 'fixed';
            cellClone.style.left = `${rect.left}px`;
            cellClone.style.top = `${rect.top}px`;
            cellClone.style.zIndex = '1000';
            cellClone.style.pointerEvents = 'none';
            cellClone.classList.add('falling');
            document.body.appendChild(cellClone);
                
                
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
            });
        }, index * 50); // 각 셀마다 약간의 지연 시간
    });

    // 누적 합 테이블 업데이트
    buildAllPrefixSums();
            
    // 힌트 미리 계산
    precomputeHints();
    
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
    
    // 힌트가 없으면 게임 오버 처리
    if (hints.length === 0) {
        console.log("힌트를 찾을 수 없습니다. 더 이상 가능한 조합이 없습니다.");
        
        // 게임 상태 확인 - 모든 셀이 비어있는지 확인
        let allCellsEmpty = true;
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                if (grid[i][j] && grid[i][j].value > 0) {
                    allCellsEmpty = false;
                    break;
                }
            }
            if (!allCellsEmpty) break;
        }
        
        // 모든 셀이 비어있다면 게임 승리로 처리, 아니면 게임 오버로 처리
        if (allCellsEmpty) {
            endGame(true); // 승리
        } else {
            endGame(false, '가능한 조합이 없습니다.'); // 패배
        }
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
    
    if (timeLeft <= 0) {
        timeLeft = 0;
        clearInterval(gameTimer);
        endGame(false);
    }

    updateUI();
}

// 게임 종료
function endGame(isWin, message = '') {
    clearInterval(gameTimer);
    clearTimeout(hintTimer); // 힌트 타이머 정리
    
    // 기본 타이틀은 '게임 종료!'로 유지
    resultMessageElement.textContent = '게임 종료!';
    
    // 종료 사유 설정
    if (message) {
        // 메시지가 제공된 경우 그대로 사용
        gameEndReasonElement.textContent = message;
    } else if (isWin) {
        gameEndReasonElement.textContent = '모든 레이어를 파헤쳤습니다!';
    } else if (timeLeft <= 0) {
        gameEndReasonElement.textContent = '시간 제한에 도달했습니다.';
    } else {
        gameEndReasonElement.textContent = '게임이 종료되었습니다.';
    }
    
    // 점수 표시 및 게임 오버 화면 표시
    finalScoreElement.textContent = score;
    gameOverElement.style.display = 'flex';
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

let benfordProbabilities = null;

// 벤포드 법칙에 따른 1~9 사이의 숫자 생성
function generateBenfordNumber() {
    // 벤포드 법칙 수식: P(d) = log10(1 + 1/d) 
    // 여기서 d는 1부터 9까지의 첫 자리 숫자
    if (benfordProbabilities === null) {
        // 먼저 각 숫자의 확률을 계산하고 총 합을 구함
        const probabilities = [];
        let totalProbability = 0;
        
        for (let d = 1; d <= 9; d++) {
            const probability = Math.log10(1 + 1/d);
            probabilities.push(probability);
            totalProbability += probability;
        }
        
        // 확률 정규화 (총합이 1이 되도록)
        for (let i = 0; i < probabilities.length; i++) {
            probabilities[i] /= totalProbability;
        }

        benfordProbabilities = probabilities;
    }
    
    // 숫자 선택
    const rand = Math.random();
    let cumulativeProbability = 0;
    
    for (let d = 1; d <= 9; d++) {
        cumulativeProbability += benfordProbabilities[d-1];
        if (rand < cumulativeProbability) {
            return d;
        }
    }
    
    // 반올림 오차로 여기까지 오면 9 반환
    return 1;
}

function isLocalhost() {
    // Get the hostname from the current URL.
    const hostname = window.location.hostname;
  
    // If hostname is empty (e.g. when using file:// protocol), treat as local.
    if (!hostname) return true;
  
    // 1. Standard hostname for localhost.
    if (hostname === 'localhost') return true;
  
    // 2. IPv6 localhost addresses.
    // Some browsers might return either "[::1]" or "::1".
    if (hostname === '[::1]' || hostname === '::1') return true;
  
    // 3. IPv4 loopback addresses.
    // According to IPv4 standards, any address in the 127.0.0.0/8 block is loopback.
    // This regular expression strictly matches numbers between 0 and 255.
    const ipv4LoopbackRegex = /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
    if (ipv4LoopbackRegex.test(hostname)) return true;
  
    // If none of the conditions are met, it's not considered localhost.
    return false;
  }
  