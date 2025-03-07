/**
 * Decomposes a 4x4 CSS transform matrix (row-major order) into:
 *   perspective, translation, rotation, skew, and scale.
 *
 * Assumes the matrix represents:
 *   M = perspective * translate3d * rotate3d * skew * scale3d
 *
 * Note: In a CSS matrix3d, the first row is [m11, m12, m13, m14],
 * the second row is [m21, m22, m23, m24],
 * the third row is [m31, m32, m33, m34],
 * and the fourth row is [m41, m42, m43, m44].
 *
 * Translation is given by m14, m24, m34,
 * and perspective (if any) is given by m41, m42, m43.
 *
 * @param {number[][]} M - 4x4 matrix (array of 4 arrays, each of length 4)
 * @returns {Object} An object with keys:
 *   perspective (number),
 *   translation {x, y, z},
 *   rotation {axis: {x, y, z}, angle},
 *   skew {alpha, beta},
 *   scale {x, y, z}
 */
function decomposeCSSMatrix(M) {
    const EPS = 1e-8;
  
    // --- Helper Functions ---
  
    // Returns the Euclidean norm of vector v.
    function vectorLength(v) {
      return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    }
  
    // Dot product of vectors v and w.
    function dot(v, w) {
      return v.reduce((sum, x, i) => sum + x * w[i], 0);
    }
  
    // Element-wise subtraction: v - w.
    function subtract(v, w) {
      return v.map((x, i) => x - w[i]);
    }
  
    // Multiply vector v by a scalar.
    function multiply(v, scalar) {
      return v.map(x => x * scalar);
    }
  
    // Element-wise addition: v + w.
    function add(v, w) {
      return v.map((x, i) => x + w[i]);
    }
  
    // Computes the determinant of a 3x3 matrix (array of 3 arrays).
    function determinant3(m3) {
      return m3[0][0] * (m3[1][1] * m3[2][2] - m3[1][2] * m3[2][1]) -
             m3[0][1] * (m3[1][0] * m3[2][2] - m3[1][2] * m3[2][0]) +
             m3[0][2] * (m3[1][0] * m3[2][1] - m3[1][1] * m3[2][0]);
    }
  
    // Multiplies a 4x4 matrix by a 4-element vector.
    function multiplyMatrixVector(mat, vec) {
      const result = [];
      for (let i = 0; i < 4; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
          sum += mat[i][j] * vec[j];
        }
        result.push(sum);
      }
      return result;
    }
  
    // Inverts a 4x4 matrix using Gaussian elimination.
    function invert4x4(matrix) {
      const m = matrix.map(row => row.slice());
      const inv = [];
      for (let i = 0; i < 4; i++) {
        inv[i] = [0, 0, 0, 0];
        inv[i][i] = 1;
      }
      for (let i = 0; i < 4; i++) {
        let pivot = m[i][i];
        if (Math.abs(pivot) < EPS) throw new Error("Singular matrix");
        for (let j = 0; j < 4; j++) {
          m[i][j] /= pivot;
          inv[i][j] /= pivot;
        }
        for (let k = 0; k < 4; k++) {
          if (k === i) continue;
          let factor = m[k][i];
          for (let j = 0; j < 4; j++) {
            m[k][j] -= factor * m[i][j];
            inv[k][j] -= factor * inv[i][j];
          }
        }
      }
      return inv;
    }
  
    // --- Begin Decomposition ---
  
    // 1. Normalize M so that M[3][3] === 1.
    if (Math.abs(M[3][3]) < EPS) throw new Error("Invalid matrix: M[3][3] is zero.");
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        M[i][j] /= M[3][3];
      }
    }
  
    // 2. Extract Perspective.
    // In a CSS matrix3d, perspective components are in the bottom row (m41, m42, m43).
    let perspective;
    if (Math.abs(M[3][0]) > EPS || Math.abs(M[3][1]) > EPS || Math.abs(M[3][2]) > EPS) {
      // Copy M to Mp and zero out the perspective elements in the bottom row.
      const Mp = M.map(row => row.slice());
      Mp[3][0] = Mp[3][1] = Mp[3][2] = 0;
      Mp[3][3] = 1;
      // Perspective vector from the original M's bottom row.
      const p = [M[3][0], M[3][1], M[3][2], 1];
      const invMp = invert4x4(Mp);
      const pPrime = multiplyMatrixVector(invMp, p);
      // For a CSS perspective(P) transform, the perspective factor is computed as:
      //   P = -1 / pPrime[2]   (if pPrime[2] is nonzero)
      perspective = (Math.abs(pPrime[2]) > EPS) ? -1 / pPrime[2] : Infinity;
    } else {
      perspective = Infinity;
    }
  
    // 3. Extract Translation.
    // For CSS matrix3d, translation components are in the fourth element of the first three rows.
    const translation = { x: M[0][3], y: M[1][3], z: M[2][3] };
    // Zero out the translation components in M.
    M[0][3] = M[1][3] = M[2][3] = 0;
  
    // 4. Isolate the upper-left 3×3 submatrix A.
    const A = [
      [M[0][0], M[0][1], M[0][2]],
      [M[1][0], M[1][1], M[1][2]],
      [M[2][0], M[2][1], M[2][2]]
    ];
  
    // 5. Decompose A into rotation, skew, and scale via Gram–Schmidt.
    // Work on the rows of A.
    let row0 = A[0].slice();
    let row1 = A[1].slice();
    let row2 = A[2].slice();
  
    // --- Extract scaleX and normalize row0.
    let scaleX = vectorLength(row0);
    row0 = row0.map(x => x / scaleX);
  
    // --- Extract shear (skew) XY.
    let shearXY = dot(row0, row1);
    // Make row1 orthogonal to row0.
    row1 = subtract(row1, multiply(row0, shearXY));
    let scaleY = vectorLength(row1);
    row1 = row1.map(x => x / scaleY);
    // Adjust shearXY relative to scaleY.
    shearXY /= scaleY;
  
    // --- Extract shear components for row2.
    let shearXZ = dot(row0, row2);
    let shearYZ = dot(row1, row2);
    // Remove the projections of row2 onto row0 and row1.
    row2 = subtract(row2, add(multiply(row0, shearXZ), multiply(row1, shearYZ)));
    let scaleZ = vectorLength(row2);
    row2 = row2.map(x => x / scaleZ);
    shearXZ /= scaleZ;
    shearYZ /= scaleZ;
  
    // --- Rotation matrix R from the orthonormal rows.
    let R = [row0, row1, row2];
    // Correct for a coordinate system flip if necessary.
    if (determinant3(R) < 0) {
      scaleX = -scaleX;
      R[0] = R[0].map(x => -x);
    }
  
    // --- Convert the 3x3 rotation matrix to axis-angle representation.
    const trace = R[0][0] + R[1][1] + R[2][2];
    let theta = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
    let rx, ry, rz;
    if (Math.abs(theta) < EPS) {
      // No rotation; choose arbitrary axis.
      rx = 1; ry = 0; rz = 0;
    } else {
      const sinTheta = Math.sin(theta);
      rx = (R[2][1] - R[1][2]) / (2 * sinTheta);
      ry = (R[0][2] - R[2][0]) / (2 * sinTheta);
      rz = (R[1][0] - R[0][1]) / (2 * sinTheta);
    }
  
    // --- For CSS, typically only the x-y skew is used.
    const alpha = Math.atan(shearXY);
    const beta = 0;
  
    // --- Assemble scale.
    const scale = { x: scaleX, y: scaleY, z: scaleZ };
  
    // --- Return the decomposed parameters.
    return {
      perspective: perspective,              // Number (CSS perspective value)
      translation: translation,              // { x, y, z }
      rotation: { axis: { x: rx, y: ry, z: rz }, angle: theta }, // Axis-angle form
      skew: { alpha: alpha, beta: beta },    // In radians
      scale: scale                           // { x, y, z }
    };
  }
  
  // --- Example Usage ---
  const matrix = [
    [1, 0.2, 0, 100],  // [m11, m12, m13, m14]
    [0, 1, 0.3, 50],   // [m21, m22, m23, m24]
    [0, 0, 1, 20],     // [m31, m32, m33, m34]
    [0, 0, 0, 1]       // [m41, m42, m43, m44]
  ];
  
  const components = decomposeCSSMatrix(matrix);
  console.log(components);
  