import numpy as np
import time
from numba import njit

# Define probability distributions and their cumulative sums for ultra-fast PRNG
p_uni = np.array([1/9] * 9)
cum_p_uni = np.cumsum(p_uni)

p_skew = np.array([
    0.17236029958730282, 0.13997459189518147, 0.12003131601760225,
    0.10742899900425040, 0.09933762576923556, 0.09415776255794744,
    0.09087548000721379, 0.08854629768368405, 0.08728762747758218
])
p_skew = p_skew / np.sum(p_skew) # Normalize to avoid floating point errors
cum_p_skew = np.cumsum(p_skew)

@njit(fastmath=True)
def run_trial_optimized(cum_p):
    # Allocate static memory
    grid = np.zeros((10, 10), dtype=np.int32)
    pref = np.zeros((11, 11), dtype=np.int32)
    
    # Pre-allocate arrays for valid coordinates (Max possible subgrids is 3025)
    valid_r1 = np.empty(3050, dtype=np.int32)
    valid_r2 = np.empty(3050, dtype=np.int32)
    valid_c1 = np.empty(3050, dtype=np.int32)
    valid_c2 = np.empty(3050, dtype=np.int32)
    
    # Initial grid fill using custom roulette selection
    for i in range(10):
        for j in range(10):
            r = np.random.random()
            for k in range(9):
                if r < cum_p[k]:
                    grid[i, j] = k + 1
                    break
                    
    steps = 0
    
    while True:
        # 1. Build 2D Prefix Sum Array O(N^2)
        for i in range(1, 11):
            for j in range(1, 11):
                pref[i, j] = grid[i-1, j-1] + pref[i-1, j] + pref[i, j-1] - pref[i-1, j-1]
        
        count = 0
        
        # 2. Find all valid subgrids O(N^4) iterations but O(1) sum checks
        for r1 in range(10):
            for r2 in range(r1, 10):
                for c1 in range(10):
                    for c2 in range(c1, 10):
                        # O(1) Prefix Sum lookup
                        total = pref[r2+1, c2+1] - pref[r1, c2+1] - pref[r2+1, c1] + pref[r1, c1]
                        if total == 10:
                            valid_r1[count] = r1
                            valid_r2[count] = r2
                            valid_c1[count] = c1
                            valid_c2[count] = c2
                            count += 1
        
        # Deadlock check
        if count == 0:
            break
            
        # 3. Fast random selection
        idx = np.random.randint(0, count)
        sr1, sr2, sc1, sc2 = valid_r1[idx], valid_r2[idx], valid_c1[idx], valid_c2[idx]
        
        # 4. Replace selected cells
        for i in range(sr1, sr2 + 1):
            for j in range(sc1, sc2 + 1):
                r = np.random.random()
                # Fast inline generation to avoid function overhead
                for k in range(9):
                    if r < cum_p[k]:
                        grid[i, j] = k + 1
                        break
        
        steps += 1
        
    return steps

def run_simulation_fast(trials=10000):
    print("JIT Compiling (Warmup)...")
    _ = run_trial_optimized(cum_p_uni) # Force LLVM compilation
    
    print(f"Running Highly Optimized Simulation ({trials} trials each)...")
    start = time.perf_counter()
    
    uni_results = np.empty(trials, dtype=np.int32)
    skew_results = np.empty(trials, dtype=np.int32)
    
    # Execute trials
    for i in range(trials):
        uni_results[i] = run_trial_optimized(cum_p_uni)
        skew_results[i] = run_trial_optimized(cum_p_skew)
        
    elapsed = time.perf_counter() - start
    
    print(f"\n--- Results ({elapsed:.4f} seconds) ---")
    print(f"Uniform Distribution -> Avg steps: {np.mean(uni_results):.2f} (Max: {np.max(uni_results)}, Min: {np.min(uni_results)})")
    print(f"Skewed Distribution  -> Avg steps: {np.mean(skew_results):.2f} (Max: {np.max(skew_results)}, Min: {np.min(skew_results)})")

if __name__ == "__main__":
    run_simulation_fast()