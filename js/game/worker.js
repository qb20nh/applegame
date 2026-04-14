import { GameEngine } from './engine.js';

let engine = null;

self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            const { rows, cols, stageNumber, seed } = payload;
            engine = new GameEngine(rows, cols);
            const grid = engine.init(stageNumber, seed);
            self.postMessage({ type: 'INIT_COMPLETE', payload: { grid } });
            break;

        case 'VALIDATE_SELECTION':
            if (!engine) return;
            const result = engine.validateSelection(payload.cells, payload);
            self.postMessage({ type: 'VALIDATION_RESULT', payload: result });
            break;

        case 'GET_HINTS':
            if (!engine) return;
            const hints = engine.findHints();
            self.postMessage({ type: 'HINTS_RESULT', payload: { hints } });
            break;
            
        default:
            console.warn(`Unknown message type: ${type}`);
    }
};
