/**
 * Nelder–Mead simplex optimizer.
 *
 * @param {Function} fn - The objective function to minimize.
 *                        It should accept a parameter vector (array) and return a number.
 * @param {number[]} initial - Initial guess for the parameters (array of length n).
 * @param {Object} [options] - Optional configuration.
 *   options.maxIterations {number} - Maximum number of iterations (default: 500).
 *   options.tolerance {number} - Tolerance for convergence (default: 1e-6).
 * @returns {number[]} - The optimized parameter vector.
 */
function optimize (fn, initial, options) {
  options = options || {}
  const maxIterations = options.maxIterations || 500
  const tolerance = options.tolerance || 1e-6
  const n = initial.length
  // Standard Nelder–Mead coefficients:
  const alpha = 1    // reflection coefficient
  const gamma = 2    // expansion coefficient
  const rho = 0.5  // contraction coefficient
  const sigma = 0.5  // shrink coefficient

  // Build initial simplex: n+1 vertices.
  let simplex = []
  let fValues = []
  // First vertex is the initial guess.
  simplex.push(initial.slice())
  fValues.push(fn(initial))
  for (let i = 0; i < n; i++) {
    const vertex = initial.slice()
    // Perturb the i-th parameter (if zero, use a small constant)
    vertex[i] = vertex[i] === 0 ? 0.00025 : vertex[i] * (1 + 0.05)
    simplex.push(vertex)
    fValues.push(fn(vertex))
  }

  // Main optimization loop.
  for (let iter = 0; iter < maxIterations; iter++) {
    // Sort the simplex vertices by their function values (ascending).
    const indices = simplex.map((_, idx) => idx)
    indices.sort((i, j) => fValues[i] - fValues[j])
    simplex = indices.map(i => simplex[i])
    fValues = indices.map(i => fValues[i])

    // Check for convergence: difference between best and worst function values.
    if (Math.abs(fValues[0] - fValues[n]) < tolerance) {
      break
    }

    // Compute the centroid of the best n vertices (exclude worst).
    let centroid = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i][j]
      }
    }
    centroid = centroid.map(x => x / n)

    // Reflection step.
    const worst = simplex[n]
    const x_r = []
    for (let j = 0; j < n; j++) {
      x_r[j] = centroid[j] + alpha * (centroid[j] - worst[j])
    }
    const f_r = fn(x_r)

    if (f_r < fValues[0]) {
      // If reflection is better than the best, try expansion.
      const x_e = []
      for (let j = 0; j < n; j++) {
        x_e[j] = centroid[j] + gamma * (x_r[j] - centroid[j])
      }
      const f_e = fn(x_e)
      if (f_e < f_r) {
        simplex[n] = x_e
        fValues[n] = f_e
      } else {
        simplex[n] = x_r
        fValues[n] = f_r
      }
    } else if (f_r < fValues[n - 1]) {
      // Accept the reflection.
      simplex[n] = x_r
      fValues[n] = f_r
    } else {
      // Contraction step.
      const x_c = []
      if (f_r < fValues[n]) {
        // Outside contraction.
        for (let j = 0; j < n; j++) {
          x_c[j] = centroid[j] + rho * (x_r[j] - centroid[j])
        }
      } else {
        // Inside contraction.
        for (let j = 0; j < n; j++) {
          x_c[j] = centroid[j] + rho * (worst[j] - centroid[j])
        }
      }
      const f_c = fn(x_c)
      if (f_c < Math.min(f_r, fValues[n])) {
        simplex[n] = x_c
        fValues[n] = f_c
      } else {
        // Shrink: move all vertices (except the best) toward the best vertex.
        for (let i = 1; i < simplex.length; i++) {
          for (let j = 0; j < n; j++) {
            simplex[i][j] = simplex[0][j] + sigma * (simplex[i][j] - simplex[0][j])
          }
          fValues[i] = fn(simplex[i])
        }
      }
    }
  }

  // Return the best vertex found.
  return simplex[0]
}

/**
 * Given the 13 parameters, rebuild the composite transform matrix.
 * The parameter vector p is assumed to be ordered as:
 *   p[0]: perspective (P)
 *   p[1..3]: translation: tx, ty, tz
 *   p[4..6]: rotation axis: rx, ry, rz (should be normalized)
 *   p[7]: rotation angle (theta, in radians)
 *   p[8..9]: skew: alpha (skewXY) and beta (skewXZ) (in radians)
 *   p[10..12]: scale: sx, sy, sz
 *
 * The composed matrix is built as:
 *   M = PerspectiveMatrix * TranslationMatrix * RotationMatrix * SkewMatrix * ScaleMatrix
 */
function buildMatrixFromParams (p) {
  // 1. Perspective matrix:
  // For a CSS-like perspective transform, if P is finite, we use:
  //   [1, 0, 0, 0;
  //    0, 1, 0, 0;
  //    0, 0, 1, -1/P;
  //    0, 0, 0, 1]
  const P = p[0]
  const perspectiveMatrix = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, (Math.abs(P) === Infinity ? 0 : -1 / P)],
    [0, 0, 0, 1]
  ]

  // 2. Translation matrix:
  const tx = p[1]; const ty = p[2]; const tz = p[3]
  const translationMatrix = [
    [1, 0, 0, tx],
    [0, 1, 0, ty],
    [0, 0, 1, tz],
    [0, 0, 0, 1]
  ]

  // 3. Rotation matrix from axis-angle (Rodrigues formula):
  let rx = p[4]; let ry = p[5]; let rz = p[6]
  const theta = p[7]
  // Normalize the axis if necessary.
  const norm = Math.sqrt(rx * rx + ry * ry + rz * rz)
  if (norm < 1e-8) { rx = 1; ry = 0; rz = 0 } else { rx /= norm; ry /= norm; rz /= norm }
  const cosT = Math.cos(theta); const sinT = Math.sin(theta)
  const oneMinusCos = 1 - cosT
  const rotationMatrix = [
    [cosT + rx * rx * oneMinusCos, rx * ry * oneMinusCos - rz * sinT, rx * rz * oneMinusCos + ry * sinT, 0],
    [ry * rx * oneMinusCos + rz * sinT, cosT + ry * ry * oneMinusCos, ry * rz * oneMinusCos - rx * sinT, 0],
    [rz * rx * oneMinusCos - ry * sinT, rz * ry * oneMinusCos + rx * sinT, cosT + rz * rz * oneMinusCos, 0],
    [0, 0, 0, 1]
  ]

  // 4. Skew matrix:
  // Here we assume only an XY skew (alpha) and an XZ skew (beta) for simplicity.
  const alpha = p[8]; const beta = p[9]
  // A simple skew in 3d can be represented by:
  //   [1, tan(alpha), tan(beta), 0;
  //    0,     1,      0,         0;
  //    0,     0,      1,         0;
  //    0,     0,      0,         1]
  const skewMatrix = [
    [1, Math.tan(alpha), Math.tan(beta), 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ]

  // 5. Scale matrix:
  const sx = p[10]; const sy = p[11]; const sz = p[12]
  const scaleMatrix = [
    [sx, 0, 0, 0],
    [0, sy, 0, 0],
    [0, 0, sz, 0],
    [0, 0, 0, 1]
  ]

  // Multiply matrices in order: perspective * translation * rotation * skew * scale.
  // You need a matrix multiplication function (multiplyMatrix(a, b)) for 4x4 matrices.
  let M = multiplyMatrix(perspectiveMatrix, translationMatrix)
  M = multiplyMatrix(M, rotationMatrix)
  M = multiplyMatrix(M, skewMatrix)
  M = multiplyMatrix(M, scaleMatrix)
  return M
}

// Helper: multiply two 4x4 matrices.
function multiplyMatrix (A, B) {
  const result = []
  for (let i = 0; i < 4; i++) {
    result[i] = []
    for (let j = 0; j < 4; j++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += A[i][k] * B[k][j]
      }
      result[i][j] = sum
    }
  }
  return result
}

// Define the objective function: sum of squared differences.
function errorFunction (p, targetMatrix) {
  const M = buildMatrixFromParams(p)
  let error = 0
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const diff = M[i][j] - targetMatrix[i][j]
      error += diff * diff
    }
  }
  return error
}

// Example usage:
// Suppose targetMatrix is the matrix you want to decompose.
const targetMatrix = [
  [1, 0.2, 0, 100],
  [0, 1, 0.3, 50],
  [0, 0, 1, 20],
  [0, 0, 0, 1]
]

// You need an optimizer that minimizes errorFunction(p, targetMatrix) over the 13 parameters p.
// As an example, using a hypothetical optimizer "optimize" that takes an objective function and an initial guess:

const initialGuess = [
  Infinity,  // perspective: if no perspective, use Infinity (or a large number)
  100, 50, 20,  // translation x, y, z
  0, 0, 1,     // rotation axis: arbitrary choice
  0,           // rotation angle (radians)
  0, 0,        // skew angles: alpha and beta
  1, 1, 1      // scale factors: sx, sy, sz
]

// Hypothetical optimization (this could be replaced with an actual optimizer such as one from mljs/fmin):
const optimizedParams = optimize(p => errorFunction(p, targetMatrix), initialGuess)
console.log('Optimized parameters:', optimizedParams)

// Then rebuild the matrix to check the fit.
const recomposedMatrix = buildMatrixFromParams(optimizedParams)
console.log('Recomposed matrix:', recomposedMatrix)
