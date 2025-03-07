import { Timer, TimerState, TimerAction } from '../utils/timer.js';
import { FSM } from '../utils/fsm.js';
import { isLocalhost } from '../utils/util.js';
import { SeededRandom, pseudoPermutation } from '../utils/random.js';

const noop = () => {};
const IS_LOCALHOST = isLocalhost();
const injectGlobal = IS_LOCALHOST ? (func, name = func.name) => {
    globalThis[name] = func;
} : noop;
injectGlobal(injectGlobal);

const gameState = FSM.simple({
    'loading': {
        'load': 'stage_select'
    },
    'stage_select': {
        'select': 'playing'
    },
    'playing': {
        'pause': 'paused',
        'game_over': 'game_result',
        'clear': 'clear_result'
    },
    'paused': {
        'resume': 'playing',
        'give_up': 'stage_select',
        'restart': 'playing'
    },
    'game_result': {
        'restart': 'playing',
        'next': 'playing',
        'go_back': 'stage_select'
    },
    'clear_result': {
        'restart': 'playing',
        'go_back': 'stage_select'
    }
});

// 시드 기반 난수 생성 관련 변수 및 함수
let currentSeed = 12345;
let randomGenerator = null;

// 시드 설정 함수
function setSeed(seed) {
    currentSeed = seed;
    randomGenerator = new SeededRandom(seed);
    console.log(`시드 설정: ${seed}`);
}

// 랜덤 생성기 가져오기
function getRandom() {
    if (!randomGenerator) {
        setSeed(currentSeed);
    }
    return randomGenerator;
}

// 스테이지 번호를 기반으로 시드 생성
function generateStageSeed(stageNumber) {
    // 기본 시드에 스테이지 번호를 결합하여 고유한 시드 생성
    return 1000000 + stageNumber * 1000 + 123;
}

// 현재 스테이지 번호 변수 추가 (기본값: 1)
let currentStageNumber = 1;

// 초기 시드 설정 - 스테이지 1 기준으로 설정
setSeed(generateStageSeed(currentStageNumber));

Object.entries(console).forEach(([name, value]) => {
    if (typeof value !== 'function') {
        return;
    }
        const wrappedFunction = new Proxy(value, {
            apply(target, thisArg, argumentsList) {
                const fn = IS_LOCALHOST ? target : noop;
                return Reflect.apply(fn, thisArg, argumentsList);
            }
        })
    console[`${name}_`] = value;
        console[name] = wrappedFunction;
})

// 게임 변수 초기화
let aspect = screen.availWidth / screen.availHeight;
const ROWS = 5;
const COLS = 10;
const TARGET_SUM = 10;
const TIME_LIMIT = 100;
const CELL_SIZE = 36; // 셀 크기(픽셀)
const GRID_GAP = 4;   // 그리드 셀 간격(픽셀)
const GRID_PADDING = 4; // 그리드 패딩(픽셀)
let HINT_DELAY = 5000; // 힌트가 표시되기까지의 시간(ms)
let HINT_DURATION = 3000; // 힌트 표시 지속 시간(ms)
const POINTER_TYPE_TOUCH = 'touch'; // 포인터 타입: 터치

let grid = [];
let selectedCells = [];
let score = 0;
let timeLeft = TIME_LIMIT;
let timerUIUpdateInterval;
let gameTimer = new Timer(() => {
    clearInterval(timerUIUpdateInterval);
    // 숫자 폭발 애니메이션 후 그리드 셀 폭발 애니메이션, 그 후 게임 오버
    explodeTimerDisplay(() => {
        explodeCellsGrid(() => {
            endGame('시간 초과!');
        });
    });
}, TIME_LIMIT * 1000);
injectGlobal(gameTimer, 'gameTimer');
gameTimer.onStart(() => {
    console.log('gameTimer onStart');
    timerUIUpdateInterval = setInterval(updateTimerUI, 100);
})
gameTimer.onResume(() => {
    console.log('gameTimer onResume');
    timerUIUpdateInterval = setInterval(updateTimerUI, 100);
})
gameTimer.onPause(() => {
    console.log('gameTimer onPause');
    clearInterval(timerUIUpdateInterval);
})
gameTimer.onReset(() => {
    console.log('gameTimer onReset');
    clearInterval(timerUIUpdateInterval);
})

let isSelecting = false;
let selectionStartCell = null;
let selectionEndCell = null;  // 선택 종료 셀 추가
let emptyCellCount = 0;
let currentSelection = [];
let lastClearTime;
let selectedSum = 0;
let currentSelectionSize = null;
let hintWaitTimer = new Timer(showHint, HINT_DELAY); // 힌트 대기 타이머
let hintDisplayTimer = new Timer(hideHint, HINT_DURATION); // 힌트 표시 타이머
hintWaitTimer.then(hintDisplayTimer);
hintDisplayTimer.then(hintWaitTimer);

hintWaitTimer.onStart(() => {
    console.log('hintWaitTimer start');
})
hintDisplayTimer.onStart(() => {
    console.log('hintDisplayTimer start');
})
hintWaitTimer.onResume(() => {
    console.log('hintWaitTimer resume');
})
hintDisplayTimer.onResume(() => {
    console.log('hintDisplayTimer resume');
})
hintWaitTimer.onPause(() => {
    console.log('hintWaitTimer pause');
})
hintDisplayTimer.onPause(() => {
    console.log('hintDisplayTimer pause');
})



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
let restartBtn = document.getElementById('restart-btn');
let stageClearInfoElement = document.getElementById('stage-clear-info');
let stageStarsElement = document.getElementById('stage-stars');
let nextStageBtn = document.getElementById('next-stage-btn');
let stageSelectBtn = document.getElementById('stage-select-btn');

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
function initGame(seed) {
    // 그리드와 게임 상태 초기화
    grid = [];
    currentSelection = [];
    selectedSum = 0;
    lastShownHintIndex = -1;
    currentHint = null;
    lastVisibleHint = null;
    secondLastVisibleHint = null;
    isHintVisible = false;
    gameStateChanged = true;
    timeLeft = TIME_LIMIT; // 게임 시간 초기화
    isPaused = false;
    
    // 게임 타이머 초기화 (Timer 클래스 사용)
    gameTimer.reset();
    
    // 힌트 타이머 초기
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    
    // DOM 요소 초기화
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('sum').textContent = '0';
    document.getElementById('time').textContent = (timeLeft).toFixed(1);
    document.getElementById('time').classList.remove('time-warning', 'time-blink-10', 'time-blink-5', 'time-blink-1');
    
    // 게임 그리드에서 일시정지 효과 제거
    if (gameGridElement) {
        gameGridElement.classList.remove('paused');
    }
    
    
    // 랜덤 시드 설정
    setSeed(seed);
    
    // 그리드 생성 및 초기화
    initGrid();

    setGridCSS();
    
    // 그리드 렌더링
    renderGrid();
    
    // 타이머 시작
    gameTimer.start();
    // 힌트 대기 타이머 시작
    hintWaitTimer.start();
    
    // 최초 힌트 캐시 계산
    precomputeHints();
}

import { halfSquare, halfStripes, verticalStripes, donuts, checker, diagonalStripes } from './patterns.js';

function getColor(stage, row, col, ROWS, COLS) {
    const patternGenerators = [
        halfSquare,
        halfStripes,
        verticalStripes,
        donuts,
        checker,
        diagonalStripes
    ]
    const patternGenerator = patternGenerators[stage % patternGenerators.length];
    return patternGenerator(row, col, ROWS, COLS);
}

function initGrid() {
    grid = [];
    for (let i = 0; i < ROWS; i++) {
        const row = [];
        for (let j = 0; j < COLS; j++) {
            // 각 셀에 값, 레이어 깊이, 색상 정보 추가
            // 오른쪽 절반은 파란색, 왼쪽 절반은 주황색으로 시작
            const isBlue = getColor(currentStageNumber, i, j, ROWS, COLS); // 오른쪽 절반 여부 확인
            
            row.push({
                value: getRandom().nextInt(1, 9), // 시드 기반 난수 생성
                layerDepth: isBlue ? 1 : 0, // 초기 레이어 깊이
                color: isBlue ? COLORS[1] : COLORS[0] // 오른쪽 절반은 파란색, 왼쪽 절반은 주황색
            });
        }
        grid.push(row);
    }
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
    stageClearInfoElement = document.getElementById('stage-clear-info');
    stageStarsElement = document.getElementById('stage-stars');
    
    // 버튼 요소
    restartBtn = document.getElementById('restart-btn');
    nextStageBtn = document.getElementById('next-stage-btn');
    stageSelectBtn = document.getElementById('stage-select-btn');
    
    // 일시 정지 관련 요소
    pauseBtn = document.getElementById('pause-btn');
    pauseMenuDialog = document.getElementById('pause-menu-dialog');
    confirmationDialog = document.getElementById('confirmation-dialog');
    
    // 화면 방향 변경 감지 리스너 (resize 이벤트 사용)
    window.addEventListener('resize', () => {
        // 이전 방향 저장
        const prevAspect = aspect;
        const wasVertical = prevAspect < 1;
        
        // 현재 화면 비율 계산
        aspect = window.innerWidth / window.innerHeight;
        const isVertical = aspect < 1;
        
        // 화면 방향이 변경된 경우에만 그리드 다시 렌더링
        if (wasVertical !== isVertical) {
            console.log('화면 방향 변경 감지: ' + (isVertical ? '세로' : '가로') + ' 모드로 전환');
            // 그리드 다시 렌더링
            renderGrid();
        }
    });
    
    // 일시 정지 버튼 클릭 이벤트
    pauseBtn.addEventListener('click', () => {
        // 다이얼로그를 먼저 표시한 후 게임 일시 정지
        pauseMenuDialog.showModal();
        pauseGame();
    });
    
    // 일시 정지 메뉴 버튼 이벤트 설정
    document.getElementById('continue-btn').addEventListener('click', () => {
        // 게임 계속하기
        pauseMenuDialog.close();
        resumeGame();
    });
    
    document.getElementById('restart-from-pause-btn').addEventListener('click', () => {
        // 다시 시작하기 확인
        pauseMenuDialog.close();
        pendingAction = 'restart';
        showConfirmation('다시 시작하기', '현재 진행 중인 게임을 초기화하고 처음부터 다시 시작하시겠습니까?');
    });
    
    document.getElementById('give-up-btn').addEventListener('click', () => {
        // 포기하기 확인
        pauseMenuDialog.close();
        pendingAction = 'giveup';
        showConfirmation('포기하기', '현재 진행 중인 게임을 포기하고 스테이지 선택 화면으로 돌아가시겠습니까?');
    });
    
    // 확인 다이얼로그 버튼 이벤트 설정
    document.getElementById('confirm-yes-btn').addEventListener('click', () => {
        confirmationDialog.close();
        
        if (pendingAction === 'restart') {
            // 현재 스테이지 재시작
            isPaused = false;
            initGame(generateStageSeed(currentStageNumber));
        } else if (pendingAction === 'giveup') {
            // 스테이지 선택 화면으로 돌아가기
            isPaused = false;
            if (stageDialog) {
                stageDialog.showModal();
            }
        }
        
        pendingAction = null;
    });
    
    document.getElementById('confirm-no-btn').addEventListener('click', () => {
        confirmationDialog.close();
        // 일시 정지 메뉴로 돌아가기
        pauseMenuDialog.showModal();
        pendingAction = null;
    });
    
    // 이벤트 리스너 설정 - 현재 스테이지 번호로 게임 재시작
    restartBtn.addEventListener('click', () => {
        // 현재 스테이지 시드로 게임 재시작
        gameOverElement.style.display = 'none';
        initGame(generateStageSeed(currentStageNumber));
    });
    
    // 다음 스테이지 버튼 클릭 시
    nextStageBtn.addEventListener('click', () => {
        // 다음 스테이지로 이동 (데이터 업데이트 포함)
        currentStageNumber++;
        stageNumberElement.textContent = currentStageNumber;
        
        // 게임 오버 화면 숨기기
        gameOverElement.style.display = 'none';
        
        // 새 스테이지로 게임 초기화
        initGame(generateStageSeed(currentStageNumber));
    });
    
    // 스테이지 선택 버튼 클릭 시
    stageSelectBtn.addEventListener('click', () => {
        // 게임 오버 화면 숨기기
        gameOverElement.style.display = 'none';
        
        // 스테이지 선택 다이얼로그 표시
        showStageSelection();
    });
    
    // 그리드 이벤트 리스너 설정 - 포인터 이벤트와 터치 이벤트 모두 추가
    gameGridElement.addEventListener('pointerdown', startSelection);
    // 이벤트를 document에 등록하여 보드 밖에서도 이동 감지
    document.addEventListener('pointermove', updateSelection);
    document.addEventListener('pointerup', endSelection);
    document.addEventListener('pointercancel', endSelection);
    
    // 모바일 터치 전용 이벤트 추가
    gameGridElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false }); // document 레벨에서 이벤트 캡처
    document.addEventListener('touchend', handleTouchEnd, { passive: false }); // document 레벨에서 이벤트 캡처
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false }); // document 레벨에서 이벤트 캡처
}

// 페이지 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 초기화
    initDom();
    
    // 스테이지 선택 다이얼로그 표시 (게임을 바로 시작하지 않음)
    if (stageDialog) {
        // 스테이지 선택 화면 준비
        if (stagesContainer.children.length === 0) {
            initPagination();
            generateStages();
        }
        // 스테이지 선택 다이얼로그 표시
        stageDialog.showModal();
    } else {
        console.error('스테이지 선택 다이얼로그를 찾을 수 없습니다.');
        // 오류 시 기본 스테이지(1)로 게임 시작
        initGame(generateStageSeed(currentStageNumber));
    }
});

// 그리드 렌더링
function renderGrid() {
    gameGridElement.innerHTML = '';
    
    // DOM 요소 캐시 초기화
    cellElements = {};
    
    // 화면이 세로 모드인지 확인 (aspect < 1일 경우 세로 모드)
    const isVertical = aspect < 1;
    
    // 세로 모드일 때 행/열 교체하여 렌더링
    const displayRows = isVertical ? COLS : ROWS;
    const displayCols = isVertical ? ROWS : COLS;
    
    // 그리드 컨테이너 스타일 설정
    gameGridElement.style.gridTemplateRows = `repeat(${displayRows}, ${CELL_SIZE}px)`;
    gameGridElement.style.gridTemplateColumns = `repeat(${displayCols}, ${CELL_SIZE}px)`;
    
    // 세로 또는 가로 모드에 따라 그리드 렌더링
    for (let i = 0; i < displayRows; i++) {
        for (let j = 0; j < displayCols; j++) {
            // 원본 그리드 좌표 계산
            const originalRow = isVertical ? (ROWS - 1 - j) : i; // -90도 회전을 위해 행 인덱스 반전
            const originalCol = isVertical ? i : j; // -90도 회전 좌표 변환
            
            const cell = grid[originalRow][originalCol];
            const cellElement = document.createElement('div');
            cellElement.className = 'cell';
            
            // 원본 좌표 저장 (이벤트 핸들링 등에 사용)
            cellElement.dataset.row = originalRow;
            cellElement.dataset.col = originalCol;
            
            // 셀 요소 캐싱 (성능 최적화)
            const cellId = `${originalRow}-${originalCol}`;
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
    if (isPaused || timeLeft <= 0) return; // 일시 정지 상태이거나 게임이 종료된 경우 무시
    
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
    
    // 터치 입력 또는 셀 요소가 아닌 경우 좌표 계산으로 찾기
    if (e.pointerType === POINTER_TYPE_TOUCH || !targetElement.classList.contains('cell')) {
        // 위치로부터 셀 좌표 계산
        selectionStartCell = getCellCoordinatesFromPosition(e.clientX, e.clientY);
        
        // 셀 요소 직접 찾기 (특히 모바일 터치에서 중요)
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
        if (elementAtPoint && elementAtPoint.classList.contains('cell')) {
            selectionStartCell = {
                row: parseInt(elementAtPoint.dataset.row, 10),
                col: parseInt(elementAtPoint.dataset.col, 10)
            };
        }
    } else {
        // 일반적인 마우스 클릭 - 타겟 요소 사용
        selectionStartCell = {
        row: parseInt(targetElement.dataset.row, 10),
        col: parseInt(targetElement.dataset.col, 10)
        };
    }
    
    clearSelection();
    selectCellsInRange(selectionStartCell, selectionStartCell);
}

// 마우스/터치 위치로부터 셀 좌표 계산
function getCellCoordinatesFromPosition(x, y) {
    // 그리드 위치 및 크기 정보 가져오기
    const gridRect = gameGridElement.getBoundingClientRect();
    
    // 화면이 세로 모드인지 확인 (aspect < 1일 경우 세로 모드)
    const isVertical = aspect < 1;
    
    // 현재 표시되는 행/열 수
    const displayRows = isVertical ? COLS : ROWS;
    const displayCols = isVertical ? ROWS : COLS;
    
    // 그리드 내 상대 위치 계산 (패딩 고려)
    const relativeX = x - gridRect.left - GRID_PADDING;
    const relativeY = y - gridRect.top - GRID_PADDING;
    
    // 유효하지 않은 좌표는 가장 가까운 유효한 셀로 보정
    let validRelativeX = Math.max(0, relativeX);
    let validRelativeY = Math.max(0, relativeY);
    
    // 세로 모드와 가로 모드에 따라 셀 좌표 계산
    // 셀 크기와 간격을 고려하여 행과 열 계산
    let displayCol = Math.floor(validRelativeX / (CELL_SIZE + GRID_GAP));
    let displayRow = Math.floor(validRelativeY / (CELL_SIZE + GRID_GAP));
    
    // 유효한 범위로 제한
    displayCol = Math.max(0, Math.min(displayCol, displayCols - 1));
    displayRow = Math.max(0, Math.min(displayRow, displayRows - 1));
    
    // 화면 방향에 따라 원본 그리드 좌표 계산
    let row, col;
    if (isVertical) {
        // 세로 모드: -90도 회전된 좌표 변환 (시계 반대 방향)
        row = ROWS - 1 - displayCol; // 행 인덱스 반전
        col = displayRow;
    } else {
        // 가로 모드: 원래 좌표 그대로 사용
        row = displayRow;
        col = displayCol;
    }
    
    // 좌표가 유효한지 확인 (그리드 영역 밖이면 가장 가까운 셀 반환)
    if (relativeX < 0 || relativeY < 0 || 
        relativeX > (CELL_SIZE + GRID_GAP) * displayCols || 
        relativeY > (CELL_SIZE + GRID_GAP) * displayRows) {
        // 로그로 유효하지 않은 좌표 기록 (디버깅용)
        console.debug('유효하지 않은 좌표 보정:', { x, y, relativeX, relativeY, fixedRow: row, fixedCol: col, isVertical });
    }
    
    return { row, col };
}

// 포인터 이동에 따른 선택 영역 업데이트 (pointermove 이벤트 핸들러)
function updateSelection(e) {
    if (isPaused || !isSelecting || timeLeft <= 0) return; // 일시 정지 상태이거나 선택 중이 아닌 경우 무시
    
    // 셀 좌표 계산 (효율적인 방식)
    const currentCell = getCellCoordinatesFromPosition(e.clientX, e.clientY);
    
    // 좌표가 유효한 범위 내에 있는지 확인하고, 범위를 벗어나면 가장 가까운 유효한 셀로 보정
    const validRow = Math.max(0, Math.min(currentCell.row, ROWS - 1));
    const validCol = Math.max(0, Math.min(currentCell.col, COLS - 1));
    
    // 보정된 좌표로 셀 업데이트
    const validCell = {
        row: validRow,
        col: validCol
    };
    
    // 셀 위치가 변경된 경우만 업데이트 - 불필요한 DOM 업데이트 방지
    if (!selectionEndCell || 
        validCell.row !== selectionEndCell.row || 
        validCell.col !== selectionEndCell.col) {
        
        selectionEndCell = validCell;
        selectCellsInRange(selectionStartCell, validCell);
    }
}

// 선택 종료
function endSelection(e) {
    if (isPaused || !isSelecting || timeLeft <= 0) return; // 일시 정지 상태이거나 선택 중이 아닌 경우 무시
    
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
        
        updateUI();
        
        // 마지막 클리어 시간 업데이트
        lastClearTime = Date.now();
        
        // 힌트가 표시 중이면 제거하고 타이머도 정리
        if (isHintVisible) {
            hideHint(true);
        }
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
        
        // 벤포드 법칙 확률 계산 (힌트 수가 많을수록 낮아짐)
        const useBenfordProbability = 1.0 / Math.sqrt(hintsCount);
        
        if (getRandom().next() < useBenfordProbability) {
            // 벤포드 법칙 사용
            newValue = getRandom().nextInt(1, 9);
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
                // 각도: 45~135도 사이 (위쪽 방향)
                angle: (45 + getRandom().next() * 90) * Math.PI / 180,
                // 초기 속도: 200~300 픽셀/초
                initialSpeed: 200 + getRandom().next() * 100,
                // 회전 속도: -360~360도/초
                rotationSpeed: -360 + getRandom().next() * 720,
                // 중력 가속도: 980 픽셀/초^2 (물리학적 중력과 유사)
                gravity: 980,
                // 애니메이션 지속 시간: 0.8~1.2초
                duration: 400 + getRandom().next() * 400,
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

    if (hints.length === 0) {
        console.log("힌트를 찾을 수 없습니다. 더 이상 가능한 조합이 없습니다.");
        endGame('가능한 조합이 없습니다.');
        return;
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
    // 게임 종료 상태이거나 일시 정지 상태면 힌트 표시 안 함
    if (timeLeft <= 0 || isPaused) {
        return;
    }
    
    // 이미 힌트가 표시 중이면 제거
    if (isHintVisible) {
        hideHint(false);
    }
    
    // 새로운 힌트 세트를 가져올 때마다 인덱스 초기화 (다양한 힌트 표시를 위해)
    if (gameStateChanged) {
        lastShownHintIndex = -1;
    }
    
    // 힌트 계산 (캐시 활용)
    const hints = findHints();
    
    console.log(`${hints.length}개의 힌트 중에서 표시할 힌트를 선택합니다.`);
    
    // 힌트 랜덤하게 선택 (이전과 다른 힌트)
    const randomIndex = getRandomDifferentHintIndex(hints.length);
    currentHint = hints[randomIndex];
    lastShownHintIndex = randomIndex; // 현재 표시된 힌트 인덱스 저장
    showCurrentHint();
}

// 이전과 다른 랜덤 힌트 인덱스 가져오기
function getRandomDifferentHintIndex(hintsLength) {
    let newIndex;
    
    do {
        newIndex = Math.floor(getRandom().next() * hintsLength);
    } while (newIndex === lastShownHintIndex);
    
    return newIndex;
}

// 선택된 힌트 표시
function showCurrentHint() {
    if (!currentHint) return;
    
    // 일시 정지 상태면 힌트 표시만 하고 타이머는 시작하지 않음
    if (isPaused) {
        return;
    }
    
    // 추가 유효성 검사 - 힌트를 표시하기 전에 모든 셀이 유효한지 확인
    const allValid = currentHint.every(cell => 
        cell.row >= 0 && cell.row < ROWS && 
        cell.col >= 0 && cell.col < COLS && 
        grid[cell.row][cell.col] && grid[cell.row][cell.col].value > 0
    );
    
    if (!allValid) {
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
            console.log(`유효하지 않은 힌트 셀: ${cell.row},${cell.col}`);
        }
    });
    
    isHintVisible = true;
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

    if (resetTimer) {
        hintWaitTimer.reset();
        hintDisplayTimer.reset();
        hintWaitTimer.start();
    }
    // 상태 초기화
    currentHint = null;
    isHintVisible = false;
}

// 물리 기반 애니메이션 시작
function startPhysicsAnimation(physics, onComplete) {
    // 일시 정지 상태에서는 애니메이션을 시작하지 않음
    // if (isPaused) {
    //     onComplete();
    //     return;
    // }
    
    // 애니메이션 시작 시간 기록
    physics.startTime = performance.now();
    
    // 애니메이션 ID를 저장할 변수
    let animationId = null;
    
    // 애니메이션 함수
    function animate(timestamp) {
        // 일시 정지 상태라면 애니메이션 중지
        if (gameTimer.state === 'paused') {
            return;
        }
        
        // 경과 시간 계산 (초 단위)
        const elapsed = (timestamp - physics.startTime) / 1000;
        
        // 애니메이션 지속 시간을 초과하면 종료
        if (elapsed >= physics.duration / 1000) {
            // 애니메이션 목록에서 제거
            const index = activeAnimations.indexOf(animationId);
            if (index !== -1) {
                activeAnimations.splice(index, 1);
            }
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

        const scale = 1 + normalizedTime * ((physics.scale ?? 1) - 1)
        
        // 스타일 적용
        physics.element.style.transform = `translate(${physics.x}px, ${physics.y}px) rotate(${physics.rotation}deg) scale(${scale})`;
        physics.element.style.opacity = physics.opacity;
        
        // 다음 프레임 요청
        animationId = requestAnimationFrame(animate);
    }
    
    // 애니메이션 시작
    animationId = requestAnimationFrame(animate);
    
    // 활성 애니메이션 목록에 추가
    activeAnimations.push(animationId);
}


// UI 업데이트
function updateUI() {
    sumElement.textContent = calculateSum();
    scoreElement.textContent = score;
    timeElement.textContent = timeLeft.toFixed(1);
}

// 타이머 UI 업데이트 함수
function updateTimerUI() {
    if (isPaused) return;
    
    // 남은 시간 계산 (시간이 지남에 따라 감소)
    const currentState = gameTimer.getState();
    const remainingTime = gameTimer.getRemainingTime();
    
    timeLeft = Math.max(0, remainingTime / 1000);
    
    // 타이머 표시 업데이트
    timeElement.textContent = timeLeft.toFixed(1);
    
    // 기존 모든 타이머 관련 클래스 제거
    timeElement.classList.remove('time-warning', 'time-blink-10', 'time-blink-5', 'time-blink-1');
    
    // 시간에 따라 다른 깜빡임 효과 적용
    if (timeLeft <= 1) {
        // 1초 이하: 1초에 5번 깜빡임 (0.2초 간격)
        timeElement.classList.add('time-blink-1');
    } else if (timeLeft <= 5) {
        // 5초 이하: 1초에 2번 깜빡임 (0.5초 간격)
        timeElement.classList.add('time-blink-5');
    } else if (timeLeft <= 10) {
        // 10초 이하: 1초에 한번 깜빡임
        timeElement.classList.add('time-blink-10');
    }
}

// 게임 종료
function endGame(message = '') {
    // 타이머 정리
    gameTimer.reset();
    hintWaitTimer.reset();
    hintDisplayTimer.reset();
    
    // 힌트 숨기기 (화면에서만 제거)
    document.querySelectorAll('.cell.hint').forEach(cell => {
        cell.classList.remove('hint');
    });
    
    // 선택 영역 초기화
    clearSelection();
    
    // 진행 중인 애니메이션 중지
    activeAnimations.forEach(id => {
        cancelAnimationFrame(id);
    });
    activeAnimations = [];
    
    // 게임 오버 메시지 설정 및 표시
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
        const messageElement = document.getElementById('game-over-message');
        if (messageElement) {
            messageElement.textContent = message || '게임 종료!';
        }
        gameOverElement.style.display = 'flex';
    }
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

// 스테이지 선택 다이얼로그 관련 코드
const stageDialog = document.getElementById('stage-selection-dialog');
const closeStageButton = document.getElementById('close-stage-selection');
const stagesContainer = document.querySelector('.stages-container');
const stageNumberElement = document.querySelector('#stage-number .stage-number');
const stageTemplate = document.getElementById('stage-template');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const pageDisplay = document.getElementById('page-display');
const pageNumbersContainer = document.querySelector('.page-numbers');

// 페이지네이션 변수
let currentPage = 1;
const totalPages = 10;
const stagesPerPage = 100;

// 다이얼로그 표시 함수
function showStageSelection() {
    // 데이터 업데이트를 위해 항상 최신 데이터 로드
    stageData.loadFromStorage();
    
    // 페이지가 이미 초기화되었는지 확인
    if (stagesContainer.children.length === 0) {
        // 첫 로드 시 페이징 초기화
        initPagination();
    }
    
    // 스테이지 데이터를 항상 새로 생성하여 최신 정보 반영
    generateStages();
    
    // 페이지 컨트롤 업데이트
    updatePageControls();
    
    // 다이얼로그 표시
    stageDialog.showModal();
}
injectGlobal(showStageSelection);

// 페이지네이션 초기화 함수
function initPagination() {
    // 페이지 번호 버튼 생성
    pageNumbersContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const pageNumberBtn = document.createElement('div');
        pageNumberBtn.className = `page-number${i === currentPage ? ' active' : ''}`;
        pageNumberBtn.textContent = i;
        pageNumberBtn.addEventListener('click', () => {
            if (i !== currentPage) {
                changePage(i);
            }
        });
        pageNumbersContainer.appendChild(pageNumberBtn);
    }
    
    // 이전/다음 페이지 버튼 이벤트 리스너
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            changePage(currentPage - 1);
        }
    });
    
    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            changePage(currentPage + 1);
        }
    });
    
    // 초기 페이지 상태 업데이트
    updatePageControls();
}

// 페이지 변경 함수
function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    updatePageControls();
    generateStages();
}

// 페이지 컨트롤 업데이트 함수
function updatePageControls() {
    // 페이지 표시 업데이트
    pageDisplay.textContent = `페이지 ${currentPage}/${totalPages}`;
    
    // 이전/다음 버튼 활성화/비활성화
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages;
    
    // 페이지 번호 버튼 활성화 상태 업데이트
    const pageNumberButtons = pageNumbersContainer.querySelectorAll('.page-number');
    pageNumberButtons.forEach((btn, index) => {
        btn.classList.toggle('active', index + 1 === currentPage);
    });
}

// 닫기 버튼 클릭 시 다이얼로그 닫기 및 게임 시작
closeStageButton.addEventListener('click', () => {
    stageDialog.close();
    // 현재 선택된 스테이지로 게임 시작
    initGame(generateStageSeed(currentStageNumber));
});

// 클릭 이벤트가 다이얼로그 바깥쪽에서 발생하면 닫기 및 게임 시작
stageDialog.addEventListener('click', (e) => {
    if (e.target === stageDialog) {
        stageDialog.close();
        // 현재 선택된 스테이지로 게임 시작
        initGame(generateStageSeed(currentStageNumber));
    }
});

// 스테이지 데이터 (로컬 스토리지에서 불러오거나 기본값 사용)
const stageData = {
    totalStages: 1000,
    completedStages: 0,
    stageScores: {},
    
    // 로컬 스토리지에서 데이터 불러오기
    loadFromStorage() {
        const storedData = localStorage.getItem('stageData');
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData);
                this.completedStages = parsedData.completedStages || 0;
                this.stageScores = parsedData.stageScores || {};
                console.log('로컬 스토리지에서 스테이지 데이터 불러옴:', this);
                return true;
            } catch (error) {
                console.error('스테이지 데이터 파싱 오류:', error);
    return false;
  }
        }
        console.log('로컬 스토리지에 저장된 데이터가 없음, 기본값 사용');
        return false;
    },
    
    // 로컬 스토리지에 데이터 저장
    saveToStorage() {
        const dataToSave = {
            completedStages: this.completedStages,
            stageScores: this.stageScores
        };
        try {
            localStorage.setItem('stageData', JSON.stringify(dataToSave));
            console.log('스테이지 데이터 저장됨:', dataToSave);
            return true;
        } catch (error) {
            console.error('스테이지 데이터 저장 오류:', error);
            return false;
        }
    },
    
    // 스테이지 클리어 처리
    clearStage(stageNumber, score) {
        // 기존 점수와 비교하여 최고 점수 저장
        if (!this.stageScores[stageNumber] || score > this.stageScores[stageNumber]) {
            this.stageScores[stageNumber] = score;
        }
        
        // 완료한 스테이지 수 업데이트
        if (stageNumber > this.completedStages) {
            this.completedStages = stageNumber;
        }
        
        // 변경사항 저장
        this.saveToStorage();
    },
    
    // 테스트용 점수 초기화 (실제 사용 시에는 제거)
    initializeScores() {
        for (let i = 1; i <= this.completedStages; i++) {
            // 무작위 점수 생성 (400~1500)
            if (!this.stageScores[i]) {
                this.stageScores[i] = Math.floor(getRandom().next() * 1100) + 400;
            }
        }
    }
};

// 데이터 불러오기
stageData.loadFromStorage();

// 별점 계산 함수 (0-3개 별)
function calculateStars(score) {
    if (score >= 150) return '★★★';
    if (score >= 100) return '★★☆';
    if (score >= 50) return '★☆☆';
    return '☆☆☆';
}

// 스테이지 타일 동적 생성 함수
function generateStages() {
    // 스테이지 컨테이너 비우기
    stagesContainer.innerHTML = '';
    
    // 현재 페이지에 해당하는 스테이지 범위 계산
    const startStage = (currentPage - 1) * stagesPerPage + 1;
    const endStage = Math.min(currentPage * stagesPerPage, stageData.totalStages);
    
    // 현재 페이지의 스테이지 생성
    for (let i = startStage; i <= endStage; i++) {
        const isCompleted = i <= stageData.completedStages;
        const isUnlocked = i <= stageData.completedStages + 1;
        
        // 템플릿 복제
        const stageItem = stageTemplate.content.cloneNode(true).querySelector('.stage-item');
        
        // 스테이지 상태 설정
        stageItem.classList.add(isUnlocked ? 'completed' : 'locked');
        stageItem.setAttribute('data-stage', i);
        
        // 스테이지 번호 설정
        const stageNumber = stageItem.querySelector('.stage-number');
        stageNumber.textContent = i;
        
        // 별점 설정 (완료된 스테이지만)
        const stars = stageItem.querySelector('.stars');
        if (isCompleted && stageData.stageScores[i]) {
            stars.textContent = calculateStars(stageData.stageScores[i]);
        } else {
            stars.style.display = 'none';
        }
        
        // 완료된 스테이지에만 클릭 이벤트 추가
        if (isUnlocked) {
            stageItem.addEventListener('click', () => {
                selectStage(i);
            });
        }
        
        // 컨테이너에 추가
        stagesContainer.appendChild(stageItem);
    }
}

// 스테이지 선택 처리 함수
function selectStage(stageNumber) {
    // 현재 스테이지 번호 업데이트
    currentStageNumber = stageNumber;
    stageNumberElement.textContent = stageNumber;
    console.log(`스테이지 ${stageNumber} 선택됨`);
    
    // 스테이지 번호에 맞는 시드 생성
    const stageSeed = generateStageSeed(stageNumber);
    
    // 다이얼로그 닫기
    stageDialog.close();
    
    // 선택한 스테이지로 게임 초기화 (시드 전달)
    initGame(stageSeed);
}

// 터치 이벤트 핸들러 - 터치 이벤트를 포인터 이벤트로 변환
function handleTouchStart(e) {
    // 게임 영역 내에서만 스크롤 방지
    const gridRect = gameGridElement.getBoundingClientRect();
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        // 게임 그리드 내부인 경우에만 스크롤 차단
        if (
            touch.clientX >= gridRect.left && 
            touch.clientX <= gridRect.right && 
            touch.clientY >= gridRect.top && 
            touch.clientY <= gridRect.bottom
        ) {
            e.preventDefault();
            
            // 가상 포인터 이벤트 생성
            const simulatedEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                target: document.elementFromPoint(touch.clientX, touch.clientY) || e.target,
                pointerType: POINTER_TYPE_TOUCH,
                pointerId: 1  // 임의의 포인터 ID
            };
            
            startSelection(simulatedEvent);
        }
    }
}

function handleTouchMove(e) {
    // 선택 중일 때만 처리
    if (isSelecting && e.touches.length > 0) {
        const touch = e.touches[0];
        
        // 스크롤 차단을 위한 조건 체크 (선택 중인 경우만)
        e.preventDefault();
        
        // 가상 포인터 이벤트 생성
        const simulatedEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: document.elementFromPoint(touch.clientX, touch.clientY) || e.target,
            pointerType: POINTER_TYPE_TOUCH,
            pointerId: 1  // 임의의 포인터 ID
        };
        
        // 선택 업데이트 - 보드 밖이어도 계속 수행
        updateSelection(simulatedEvent);
    }
}

function handleTouchEnd(e) {
    if (isSelecting) {
        // 선택 중이었다면 스크롤 방지
        e.preventDefault();
        
        // 가상 포인터 이벤트 생성
        const simulatedEvent = {
            pointerType: POINTER_TYPE_TOUCH,
            target: e.target,
            pointerId: 1  // 임의의 포인터 ID
        };
        
        endSelection(simulatedEvent);
    }
}

const DBG = {
    backup: {
        HINT_DELAY,
        HINT_DURATION
    },
    hint() {
        this.backup.HINT_DELAY = HINT_DELAY;
        this.backup.HINT_DURATION = HINT_DURATION;
        HINT_DELAY = 0;
        HINT_DURATION = 100000;
    },
    hint_reset() {
        HINT_DELAY = this.backup.HINT_DELAY;
        HINT_DURATION = this.backup.HINT_DURATION;
    },
    gameover() {
        // immediately end game
        endGame('테스트용 게임 종료');
    }
};
if (IS_LOCALHOST) {
    injectGlobal(DBG, 'DBG');
}

// 전역 변수에 일시 정지 관련 변수 추가
// ... 기존 전역 변수들 ...
let isPaused = false; // 게임 일시 정지 상태
let pauseBtn = null; // 일시 정지 버튼
let pauseMenuDialog = null; // 일시 정지 메뉴 다이얼로그
let confirmationDialog = null; // 확인 다이얼로그
let pendingAction = null; // 확인 대기 중인 작업
let activeAnimations = []; // 활성 애니메이션 목록을 추적하기 위한 배열

// 게임 일시 정지 함수
function pauseGame() {
    if (isPaused || timeLeft <= 0) return; // 이미 일시 정지 상태이거나 게임이 종료된 경우 무시
    
    isPaused = true;
    
    // 게임 타이머 일시 정지
    gameTimer.pause();
    
    // 힌트 표시 타이머 일시 정지
    hintDisplayTimer.pause();
    
    // 힌트 생성 타이머 일시 정지
    hintWaitTimer.pause();
    
    // 시간 깜빡임 애니메이션 제거
    timeElement.classList.remove('time-warning', 'time-blink-10', 'time-blink-5', 'time-blink-1');
    
    // 게임 그리드에 일시 정지 시각적 효과 추가
    gameGridElement.classList.add('paused');
    
    // 모든 애니메이션 중지
    activeAnimations.forEach(id => {
        cancelAnimationFrame(id);
    });
    activeAnimations = [];
}

// 게임 재개 함수
function resumeGame() {
    if (!isPaused) return; // 일시 정지 상태가 아닌 경우 무시
    
    isPaused = false;
    
    // 타이머 재개
    if (timeLeft > 0) {
        gameTimer.resume();
        hintWaitTimer.resume();
        hintDisplayTimer.resume();

    }
    
    // 시간에 따라 깜빡임 효과 다시 적용
    if (timeLeft <= 1) {
        timeElement.classList.add('time-blink-1');
    } else if (timeLeft <= 5) {
        timeElement.classList.add('time-blink-5');
    } else if (timeLeft <= 10) {
        timeElement.classList.add('time-blink-10');
    }
    
    // 게임 그리드에서 일시 정지 시각적 효과 제거
    gameGridElement.classList.remove('paused');
}

// 확인 다이얼로그 표시 함수
function showConfirmation(title, message) {
    document.getElementById('confirmation-title').textContent = title;
    document.getElementById('confirmation-message').textContent = message;
    confirmationDialog.showModal();
}


// Timer 객체 생성 함수
function createTimer(callback, delay) {
    return new Timer(callback, delay);
}


// 타이머 디스플레이 폭발 애니메이션
function explodeTimerDisplay(onComplete) {
    console.log('=== 타이머 폭발 애니메이션 시작 ===');
    
    // 타이머 요소의 원래 내용 저장 (0.0)
    const originalTime = timeElement.textContent;
    console.log(`현재 타이머 값: ${originalTime}`);
    
    // 모든 인터랙션 비활성화
    // 이미 isPaused를 사용하여 인터랙션을 제어하므로 임시로 일시정지 상태로 설정
    const wasAlreadyPaused = isPaused;
    isPaused = true;
    
    // 타이머 요소의 위치와 크기 정보 저장
    const timerRect = timeElement.getBoundingClientRect();
    
    // 폭발할 숫자들을 담을 컨테이너 생성
    const explodingContainer = document.createElement('div');
    explodingContainer.style.position = 'absolute';
    explodingContainer.style.left = `${timerRect.left}px`;
    explodingContainer.style.top = `${timerRect.top}px`;
    explodingContainer.style.width = `${timerRect.width}px`;
    explodingContainer.style.height = `${timerRect.height}px`;
    explodingContainer.style.fontSize = window.getComputedStyle(timeElement).fontSize;
    explodingContainer.style.fontFamily = window.getComputedStyle(timeElement).fontFamily;
    explodingContainer.style.fontWeight = window.getComputedStyle(timeElement).fontWeight;
    explodingContainer.style.color = window.getComputedStyle(timeElement).color;
    explodingContainer.style.display = 'flex';
    explodingContainer.style.justifyContent = 'center';
    explodingContainer.style.zIndex = '1000';
    
    // 원래의 타이머 숫자 숨기기
    timeElement.style.visibility = 'hidden';
    
    // 문서에 컨테이너 추가
    document.body.appendChild(explodingContainer);
    
    // 숫자 문자열을 각 문자로 분리 (0.0)
    const characters = originalTime.split('');
    
    // 각 문자에 대한 요소 생성
    const characterElements = characters.map(char => {
        const charElement = document.createElement('div');
        charElement.textContent = char;
        charElement.style.display = 'inline-block';
        charElement.style.position = 'relative';
        explodingContainer.appendChild(charElement);
        return charElement;
    });
    
    // 모든 애니메이션 완료를 추적할 카운터
    let completedAnimations = 0;
    
    // 각 문자에 물리 애니메이션 적용
    characterElements.forEach(element => {
        // 소수점은 작은 흔들림만 주고 빠르게 사라지게
        const isDot = element.textContent === '.';
        
        // 물리 애니메이션 파라미터 설정
        const physics = {
            element: element,
            // 각도: 45~135도 사이 (위쪽 방향)
            angle: (45 + getRandom().next() * 90) * Math.PI / 180,
            // 초기 속도: 200~300 픽셀/초
            initialSpeed: 200 + getRandom().next() * 100,
            // 회전 속도: -360~360도/초
            rotationSpeed: -360 + getRandom().next() * 720,
            // 중력 가속도: 980 픽셀/초^2 (물리학적 중력과 유사)
            gravity: 980,
            // 애니메이션 지속 시간: 0.8~1.2초
            duration: 400 + getRandom().next() * 400,
            // 타임스탬프 초기화
            opacity: 1,
            x: 0,
            y: 0,
            rotation: 0
        };
        
        // 물리 애니메이션 시작
        startPhysicsAnimation(physics, () => {
            // 애니메이션 완료 카운트 증가
            completedAnimations++;
            
            // 모든 애니메이션이 완료되면 정리 및 콜백 실행
            if (completedAnimations === characterElements.length) {
                // 컨테이너 제거
                document.body.removeChild(explodingContainer);
                
                // 원래 타이머 요소 표시 (필요한 경우)
                // timeElement.style.visibility = 'visible';
                
                // 원래 게임이 일시정지 상태가 아니었다면 일시정지 해제
                isPaused = wasAlreadyPaused;
                
                // 콜백 실행
                onComplete?.();
            }
        });
    });
}

// 그리드 셀 폭발 애니메이션
function explodeCellsGrid(onComplete) {
    console.log('=== 그리드 셀 폭발 애니메이션 시작 ===');
    
    // 모든 인터랙션 비활성화
    const wasAlreadyPaused = isPaused;
    isPaused = true;
    
    // 현재 그리드의 모든 셀 요소 수집
    const cellElements = document.querySelectorAll('.cell:not(.empty)');
    console.log(`애니메이션 적용할 셀 수: ${cellElements.length}`);
    
    if (cellElements.length === 0) {
        // 셀이 없으면 즉시 완료
        isPaused = wasAlreadyPaused;
        if (onComplete && typeof onComplete === 'function') {
            onComplete();
        }
        return;
    }
    
    // 모든 애니메이션 완료를 추적할 카운터
    let completedAnimations = 0;
    const totalAnimations = cellElements.length;
    
    // 정규 분포 파라미터 설정
    const MEAN_DELAY = 1000; // 평균 지연 시간 (ms)
    const STD_DEVIATION = 500; // 표준 편차 (ms)
    const MIN_DELAY = 0; // 최소 지연 시간
    const MAX_DELAY = 2000; // 최대 지연 시간
    
    // 정규 분포 난수 생성 (Box-Muller 변환 사용)
    function getNormalRandom(mean, stdDev) {
        // Box-Muller 변환을 사용한 정규 분포 난수 생성
        const u1 = Math.random();
        const u2 = Math.random();
        
        // 표준 정규 분포 난수 생성 (평균 0, 표준편차 1)
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        
        // 원하는 평균과 표준편차로 변환
        return mean + z0 * stdDev;
    }
    
    // 난수 값을 범위 내로 제한하는 함수
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    
    // 모든 셀에 대해 정규 분포된 지연 후 물리 애니메이션 적용
    cellElements.forEach(element => {
        // 정규 분포 지연 시간 생성 및 범위 제한
        const delay = clamp(getNormalRandom(MEAN_DELAY, STD_DEVIATION), MIN_DELAY, MAX_DELAY);
        
        // 지연 후 애니메이션 시작
        setTimeout(() => {
            // 물리 애니메이션 파라미터
            const physics = {
                // 각도: 45~135도 사이 (위쪽 방향)
                angle: (45 + getRandom().next() * 90) * Math.PI / 180,
                // 초기 속도: 200~300 픽셀/초
                initialSpeed: 200 + getRandom().next() * 100,
                // 회전 속도: -360~360도/초
                rotationSpeed: -360 + getRandom().next() * 720,
                // 중력 가속도: 980 픽셀/초^2 (물리학적 중력과 유사)
                gravity: 980,
                // 애니메이션 지속 시간: 0.8~1.2초
                duration: 400 + getRandom().next() * 400,
                // 타임스탬프 초기화
                startTime: null,
                // 위치 및 회전 추적
                x: 0,
                y: 0,
                rotation: 0,
                opacity: 1,
                element: element
            };
            
            // 애니메이션 시작 전 원래 셀의 색상과 내용 복사
            const cellRect = element.getBoundingClientRect();
            const cellStyle = window.getComputedStyle(element);
            
            // 원래 셀 숨기기
            element.style.visibility = 'hidden';
            
            // 새 요소 생성하여 원래 셀을 복제
            const cloneElement = document.createElement('div');
            cloneElement.className = element.className;
            cloneElement.innerHTML = element.innerHTML;
            cloneElement.style.position = 'absolute';
            cloneElement.style.left = `${cellRect.left}px`;
            cloneElement.style.top = `${cellRect.top}px`;
            cloneElement.style.width = `${cellRect.width}px`;
            cloneElement.style.height = `${cellRect.height}px`;
            cloneElement.style.zIndex = '999';
            cloneElement.style.borderRadius = cellStyle.borderRadius;
            cloneElement.style.backgroundColor = cellStyle.backgroundColor;
            
            // 문서에 복제 요소 추가
            document.body.appendChild(cloneElement);
            
            // 물리 애니메이션에는 복제된 요소 사용
            physics.element = cloneElement;
            
            // 애니메이션 시작
            startPhysicsAnimation(physics, () => {
                // 복제 요소 제거
                if (document.body.contains(cloneElement)) {
                    document.body.removeChild(cloneElement);
                }
                
                // 애니메이션 완료 카운트 증가
                completedAnimations++;
                
                // 모든 애니메이션 완료 확인
                if (completedAnimations === totalAnimations) {
                    console.log('모든 셀 애니메이션 완료');
                    
                    // 원래 셀 다시 표시
                    cellElements.forEach(cell => {
                        cell.style.visibility = 'visible';
                        timeElement.style.visibility = 'visible';
                    });
                    
                    // 일시정지 상태 복원
                    isPaused = wasAlreadyPaused;
                    
                    // 콜백 실행
                    if (onComplete && typeof onComplete === 'function') {
                        onComplete();
                    }
                }
            });
        }, delay);
    });
}