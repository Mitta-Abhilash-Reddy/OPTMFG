"""
core/optimizer.py
──────────────────
Multi-objective optimizer using NSGA-II from pymoo.
Calls the simulator (surrogate model) as its evaluation function.
"""

import numpy as np
from pymoo.core.problem import Problem
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.optimize import minimize
from pymoo.termination import get_termination

from core.simulator import predict_all

# ── Decision variable bounds ──────────────────────────────────────────────────
PARAM_NAMES = [
    "granulation_time",
    "binder_amount",
    "drying_temp",
    "drying_time",
    "compression_force",
    "machine_speed",
    "lubricant_conc",
    "moisture_content",
]

XL = np.array([10.0,  8.0, 150.0, 30.0,  6.0,  80.0, 0.2, 4.0])
XU = np.array([30.0, 18.0, 200.0, 70.0, 18.0, 140.0, 1.5, 9.0])

# Mode weights:  (energy_w, carbon_w, neg_quality_w, neg_reliability_w)
MODE_WEIGHTS = {
    "balanced":     (1.0, 1.0, 1.0, 1.0),
    "energy_saver": (2.0, 2.0, 0.5, 0.5),
    "quality_max":  (0.5, 0.5, 2.0, 2.0),
}


class BatchOptimizationProblem(Problem):
    def __init__(self, quality_min: float, energy_max: float, mode: str):
        super().__init__(
            n_var=len(PARAM_NAMES),
            n_obj=3,        # minimize: energy, carbon, -quality
            n_constr=2,     # quality >= quality_min,  energy <= energy_max
            xl=XL,
            xu=XU,
        )
        self.quality_min = quality_min
        self.energy_max  = energy_max
        self.weights     = MODE_WEIGHTS.get(mode, MODE_WEIGHTS["balanced"])

    def _evaluate(self, X, out, *args, **kwargs):
        F, G = [], []
        ew, cw, qw, _ = self.weights

        for x in X:
            params = {name: float(val) for name, val in zip(PARAM_NAMES, x)}
            pred   = predict_all(params)

            f1 = ew  * pred["energy_batch"]
            f2 = cw  * pred["carbon_batch"]
            f3 = qw  * (-pred["quality_score"])   # maximise quality

            # Constraints  (≤ 0  means satisfied)
            g1 = self.quality_min - pred["quality_score"]   # quality must be ≥ min
            g2 = pred["energy_batch"] - self.energy_max     # energy must be ≤ max

            F.append([f1, f2, f3])
            G.append([g1, g2])

        out["F"] = np.array(F)
        out["G"] = np.array(G)


def run_optimization(
    mode: str       = "balanced",
    quality_min: float = 0.90,
    energy_max:  float = 160.0,
    pop_size:    int   = 80,
    n_gen:       int   = 60,
) -> list[dict]:
    """
    Runs NSGA-II and returns a list of Pareto-optimal solutions.
    Each solution is a dict with parameters + predicted KPIs.
    """
    problem   = BatchOptimizationProblem(quality_min, energy_max, mode)
    algorithm = NSGA2(pop_size=pop_size)
    termination = get_termination("n_gen", n_gen)

    res = minimize(
        problem,
        algorithm,
        termination,
        seed=42,
        verbose=False,
    )

    solutions = []
    if res.X is None:
        return solutions

    for i, x in enumerate(res.X):
        params = {name: round(float(val), 3) for name, val in zip(PARAM_NAMES, x)}
        pred   = predict_all(params)
        solutions.append({
            "solution_id":      i,
            **params,
            "energy_batch":     pred["energy_batch"],
            "carbon_batch":     pred["carbon_batch"],
            "quality_score":    pred["quality_score"],
            "reliability_idx":  pred["reliability_idx"],
        })

    return solutions


def pick_recommended(solutions: list[dict], mode: str) -> dict:
    """Pick the single best solution based on mode strategy."""
    if not solutions:
        return {}

    if mode == "energy_saver":
        return min(solutions, key=lambda s: s["energy_batch"])
    elif mode == "quality_max":
        return max(solutions, key=lambda s: s["quality_score"])
    else:  # balanced — minimise energy + carbon, maximise quality
        def score(s):
            return s["energy_batch"] + s["carbon_batch"] - 100 * s["quality_score"]
        return min(solutions, key=score)
