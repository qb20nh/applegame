const longShort = (R, C, r, c) => R > C ? [R, C, r, c] : [C, R, c, r];

export function halfSquare(row, col, ROWS, COLS) {
    const [long, short, l, s] = longShort(ROWS, COLS, row, col);
    return l < long / 2;
}

export function halfStripes(row, col, ROWS, COLS) {
    return true;
}

export function verticalStripes(row, col, ROWS, COLS) {
    return true;
}

export function donuts(row, col, ROWS, COLS) {
    return true;
}

export function checker(row, col, ROWS, COLS) {
    return true;
}

export function diagonalStripes(row, col, ROWS, COLS) {
    return true;
}