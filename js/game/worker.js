import { GameEngine } from './engine.js'

let engine = null

self.onmessage = function (e) {
  const { type, payload } = e.data

  switch (type) {
    case 'INIT':
      const { rows, cols, stageNumber, seed, gameMode } = payload
      engine = new GameEngine(rows, cols)
      const grid = engine.init(stageNumber, seed, gameMode)
      self.postMessage({ type: 'INIT_COMPLETE', payload: { grid } })
      break

    case 'VALIDATE_SELECTION':
      if (!engine) return
      const result = engine.validateSelection(payload.cells, payload)
      self.postMessage({ type: 'VALIDATION_RESULT', payload: result })
      break

    case 'GET_HINTS':
      if (!engine) return
      const hints = engine.findHints()
      self.postMessage({ type: 'HINTS_RESULT', payload: { hints } })
      break

    case 'SET_GRID':
      if (!engine) return
      engine.setGrid(payload.grid)
      self.postMessage({ type: 'GRID_SYNCED' })
      break

    default:
      console.warn(`Unknown message type: ${type}`)
  }
}
