const longShort = (R, C, r, c) => R > C ? [R, C, r, c] : [C, R, c, r]
const XOR = (a, b) => a !== b
const EVEN = (a) => a % 2 === 0

export function flat (row, col, ROWS, COLS) {
  return true
}

export function halfSquare (row, col, ROWS, COLS) {
  const [L, , l] = longShort(ROWS, COLS, row, col)
  return l < (L / 2)
}

export function halfStripes (row, col, ROWS, COLS) {
  const [L, , l, s] = longShort(ROWS, COLS, row, col)
  return XOR(l < (L / 2), EVEN(s))
}

export function verticalStripes (row, col, ROWS, COLS) {
  const [, , l] = longShort(ROWS, COLS, row, col)
  return EVEN(l)
}

export function donuts (row, col, ROWS, COLS) {
  const [L, S, l, s] = longShort(ROWS, COLS, row, col)
  const x = l % (L / 2)
  const y = s
  const H = S - 1
  const h = Math.min(x, y, H - x, H - y)
  return XOR(l < (L / 2), EVEN(h))
}

export function checker (row, col, ROWS, COLS) {
  const [, , l, s] = longShort(ROWS, COLS, row, col)
  return XOR(EVEN(l), EVEN(s))
}

export function diagonalStripes (row, col, ROWS, COLS) {
  const [, , l, s] = longShort(ROWS, COLS, row, col)
  return EVEN((l + s) / 2) || EVEN((l + s + 1) / 2)
}

export function split50 (row, col, ROWS, COLS) {
  return col < (COLS / 2)
}
