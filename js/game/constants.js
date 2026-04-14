// 게임 전역 상수
export const ROWS = 5;
export const COLS = 10;
export const TARGET_SUM = 10;
export const TIME_LIMIT = 100;
export const CELL_SIZE = 36; // 셀 크기(픽셀)
export const GRID_GAP = 4;   // 그리드 셀 간격(픽셀)
export const GRID_PADDING = 4; // 그리드 패딩(픽셀)
export const HINT_DELAY = 5000; // 힌트가 표시되기까지의 시간(ms)
export const HINT_DURATION = 3000; // 힌트 표시 지속 시간(ms)

export const POINTER_TYPE_TOUCH = 'touch';

export const COLORS = ['orange', 'blue']; // 색상 순환 배열

export const STAR_THRESHOLDS = {
    ONE: 50,
    TWO: 150,
    THREE: 250
};
