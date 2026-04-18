import { ROWS, COLS, TARGET_SUM, POINTER_TYPE_TOUCH } from './constants.js'
import { state } from './state.js'
import { ui } from './ui.js'

export function getCellCoordinatesFromPosition (x, y, aspect) {
  const gridRect = ui.gameGridElement.getBoundingClientRect()
  const rows = state.rows
  const cols = state.cols
  const cellSize = 36 // Constant CELL_SIZE from constants.js

  const isVertical = aspect < 1
  const displayRows = isVertical ? cols : rows
  const displayCols = isVertical ? rows : cols

  const relativeX = x - gridRect.left - 4 // GRID_PADDING
  const relativeY = y - gridRect.top - 4 // GRID_PADDING

  let displayCol = Math.floor(relativeX / (cellSize + 4)) // cellSize + GRID_GAP
  let displayRow = Math.floor(relativeY / (cellSize + 4))

  displayCol = Math.max(0, Math.min(displayCol, displayCols - 1))
  displayRow = Math.max(0, Math.min(displayRow, displayRows - 1))

  if (isVertical) {
    return { row: rows - 1 - displayCol, col: displayRow }
  }
  return { row: displayRow, col: displayCol }
}

export function selectCellsInRange (startCell, endCell) {
  if (!startCell || !endCell) {
    clearSelection()
    return
  }

  const minRow = Math.min(startCell.row, endCell.row)
  const maxRow = Math.max(startCell.row, endCell.row)
  const minCol = Math.min(startCell.col, endCell.col)
  const maxCol = Math.max(startCell.col, endCell.col)

  const startCellColor = state.grid[startCell.row][startCell.col].color

  // Clear previous selection
  Object.values(ui.cellElements).forEach(el => el.classList.remove('selected', 'invalid'))

  state.selectedCells = []
  state.selectedSum = 0

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cell = state.grid[r][c]
      const cellEl = ui.cellElements[`${r}-${c}`]

      if (cell && cell.value > 0 && cell.color === startCellColor) {
        state.selectedCells.push({ ...cell, row: r, col: c })
        state.selectedSum += cell.value
        if (cellEl) cellEl.classList.add('selected')
      }
    }
  }

  // Check sum consistency
  if (state.selectedSum > TARGET_SUM) {
    state.selectedCells.forEach(cell => {
      const el = ui.cellElements[`${cell.row}-${cell.col}`]
      if (el) el.classList.add('invalid')
    })
  }

  ui.updateUI()
}

export function clearSelection () {
  Object.values(ui.cellElements).forEach(el => el.classList.remove('selected', 'invalid'))
  state.selectedCells = []
  state.selectedSum = 0
  state.selectionStartCell = null
  state.selectionEndCell = null
  ui.updateUI()
}
