/**
 * 시드 기반 난수 생성 클래스
 */
export class SeededRandom {
  constructor (seed) {
    this.seed = seed
  }

  // 0~1 사이의 난수 생성
  next () {
    const x = Math.sin(this.seed++) * 10000
    return x - Math.floor(x)
  }

  // min~max 사이의 정수 난수 생성
  nextInt (min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  // 배열을 섞는 함수 (Fisher-Yates 알고리즘)
  shuffle (array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

/**
 * Generates a pseudorandom permutation for values [0, n-1] using a Feistel network.
 * Both n and seed affect the generated permutation such that even small changes result in a completely different mapping.
 *
 * @param {number} n - The range for the permutation (0 to n-1)
 * @param {number} input - An integer in the range [0, n-1]
 * @param {number} rounds - Number of Feistel rounds (default is 4)
 * @param {number} seed - Additional seed value for further randomisation (default is 0)
 * @returns {number} A pseudorandom mapping of input in the range [0, n-1]
 */
export function pseudoPermutation (n, input, rounds = 4, seed = 0) {
  if (n <= 1) return 0 // Only one possible value.
  if (input < 0 || input >= n) {
    throw new Error(`Input out of range (0-${n - 1})`)
  }
  // Determine the minimum number of bits required to cover n.
  const m = Math.ceil(Math.log2(n))

  // Apply the Feistel network to get an m-bit result and use cycle-walking to ensure the result is in [0, n-1].
  let res = feistelPermutation(input, m, rounds, n, seed)
  while (res >= n) {
    res = feistelPermutation(res, m, rounds, n, seed)
  }
  return res
}

/**
 * Applies a Feistel network to an m-bit number to generate a pseudorandom permutation.
 * The parameters n and seed are used in key derivation so that even small changes affect the output significantly.
 *
 * @param {number} x - The m-bit integer input (0 <= x < 2^m)
 * @param {number} m - Total number of bits
 * @param {number} rounds - Number of rounds in the Feistel network
 * @param {number} n - Current n value (used for key derivation)
 * @param {number} seed - Additional seed value (used for key derivation)
 * @returns {number} The transformed m-bit integer after applying the Feistel network
 */
function feistelPermutation (x, m, rounds, n, seed) {
  // Split x into two parts: left and right.
  const lBits = Math.floor(m / 2)
  const rBits = m - lBits
  const rMask = (1 << rBits) - 1

  let L = x >> rBits
  let R = x & rMask

  // Derive keys using n, seed, and round number.
  const keys = deriveKeys(n, rounds, rBits, seed)

  // Perform Feistel rounds.
  for (let round = 0; round < rounds; round++) {
    const newL = R
    const f = feistelRoundFunction(R, keys[round], rBits)
    const newR = L ^ f
    L = newL
    R = newR
  }

  // Combine the left and right parts to form the final m-bit result.
  return (L << rBits) | (R & rMask)
}

/**
 * Derives round keys based on n, seed, and the round number.
 * The derived keys are within the range of R_bits (i.e. [0, 2^(R_bits)-1]) and vary significantly even with small changes in n or seed.
 *
 * @param {number} n - The current n value
 * @param {number} rounds - Number of rounds
 * @param {number} rBits - Number of bits for the right half of the input
 * @param {number} seed - Additional seed value
 * @returns {number[]} An array of keys for each round.
 */
function deriveKeys (n, rounds, rBits, seed) {
  const keys = []
  const mask = (1 << rBits) - 1
  for (let j = 0; j < rounds; j++) {
    // Mix n, seed, and the round number to produce a key.
    // The constants 0x45d9f3b and 0x119de1f3 are arbitrary mixing constants.
    const key = (((n ^ seed) * 0x4_5d_9f_3b) ^ ((j + seed) * 0x11_9d_e1_f3)) & mask
    keys.push(key)
  }
  return keys
}

/**
 * A simple round function for the Feistel network.
 * It takes the right half and the round key, performs arithmetic and bitwise operations, and returns a value within the given bit range.
 *
 * @param {number} R - The right half of the input for the round
 * @param {number} key - The round key
 * @param {number} bits - The number of bits in the R part
 * @returns {number} The result of the round function, confined to the given bit range
 */
function feistelRoundFunction (R, key, bits) {
  const mod = 1 << bits
  const result = (R + key) % mod
  // Perform a left cyclic shift by 1 bit within the bit width.
  return ((result << 1) | (result >> (bits - 1))) & (mod - 1)
}
