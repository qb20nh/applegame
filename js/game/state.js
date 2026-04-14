import { FSM } from '../utils/fsm.js';
import { TIME_LIMIT } from './constants.js';

// 게임 전역 상태 관리
export const state = {
    grid: [],
    selectedCells: [],
    score: 0,
    timeLeft: TIME_LIMIT,
    isSelecting: false,
    selectionStartCell: null,
    selectionEndCell: null,
    emptyCellCount: 0,
    currentSelection: [],
    lastClearTime: Date.now(),
    selectedSum: 0,
    currentSelectionSize: null,
    currentStageNumber: 1,
    isHintVisible: false,
    currentHint: null,
    lastVisibleHint: null,
    secondLastVisibleHint: null,
    cachedHints: null,
    lastShownHintIndex: -1,
    isPaused: false,
    gameStateChanged: false,
    gameMode: 'stage', // 'stage' or 'frenzy'
    frenzyHighScore: 0,
    rows: 5,
    cols: 10
};

export const gameState = FSM.simple({
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

export function generateStageSeed(stageNumber) {
    return 1000000 + stageNumber * 1000 + 123;
}
