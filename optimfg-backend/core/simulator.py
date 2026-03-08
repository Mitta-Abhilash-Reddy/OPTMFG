"""
core/simulator.py
─────────────────
Mock surrogate model.  Mimics what the real XGBoost models will return.

HOW TO SWAP IN REAL MODELS
───────────────────────────
1.  Place your trained model files (joblib/pickle) in  models/saved/
        model_E.joblib   →  predicts energy_batch
        model_Q.joblib   →  predicts quality_score
        model_V.joblib   →  predicts reliability_idx

2.  In this file replace the three lines marked  # MOCK  with:
        import joblib
        _model_E = joblib.load("models/saved/model_E.joblib")
        _model_Q = joblib.load("models/saved/model_Q.joblib")
        _model_V = joblib.load("models/saved/model_V.joblib")

3.  Replace the body of  predict_all()  with:
        row = _build_feature_row(params)
        energy   = float(_model_E.predict(row)[0])
        quality  = float(_model_Q.predict(row)[0])
        reliab   = float(_model_V.predict(row)[0])
        carbon   = energy * EMISSION_FACTOR
        ...

Everything else (routes, optimizer, schemas) stays the same.
"""

import math
import random
import os
from dotenv import load_dotenv

load_dotenv()
EMISSION_FACTOR = float(os.getenv("EMISSION_FACTOR", 0.7))


def predict_all(params: dict) -> dict:
    """
    params keys (all float):
        granulation_time, binder_amount, drying_temp, drying_time,
        compression_force, machine_speed, lubricant_conc, moisture_content

    Returns predicted outcomes as a dict.
    """

    # ── MOCK formulas  (physics-inspired, deterministic + tiny noise) ─────────
    gt  = params["granulation_time"]
    ba  = params["binder_amount"]
    dt  = params["drying_temp"]
    dti = params["drying_time"]
    cf  = params["compression_force"]
    ms  = params["machine_speed"]
    lc  = params["lubricant_conc"]
    mc  = params["moisture_content"]

    # Energy — higher speed / temp / time → more energy
    energy = (
        0.6 * ms
        + 0.4 * dt
        + 0.3 * dti
        + 0.2 * gt
        + 0.15 * cf
        - 0.5 * lc          # lubricant reduces friction → less energy
        + random.gauss(0, 1.5)
    )
    energy = max(80.0, min(200.0, energy))

    carbon = round(energy * EMISSION_FACTOR, 3)

    # Quality — sweet spots around mid-range values
    quality = (
        0.85
        + 0.002  * (20 - abs(gt - 18))
        + 0.003  * (1  - abs(mc - 6.5) / 5)
        + 0.002  * (1  - abs(dt - 175) / 50)
        + 0.001  * (1  - abs(cf - 12)  / 10)
        - 0.0005 * abs(ms - 115)
        + random.gauss(0, 0.008)
    )
    quality = max(0.70, min(0.99, quality))

    # Reliability — vibration / anomaly proxy
    reliability = (
        0.90
        - 0.003 * abs(ms - 110)
        - 0.002 * abs(cf - 11)
        + 0.001 * lc
        + random.gauss(0, 0.01)
    )
    reliability = max(0.50, min(0.99, reliability))

    # Individual quality sub-metrics (derived from quality_score)
    hardness         = round(6 + quality * 6, 2)        # N  (higher = better)
    friability       = round((1 - quality) * 2, 3)      # %  (lower  = better)
    dissolution_rate = round(quality * 95, 1)            # %  (higher = better)

    return {
        "energy_batch":     round(energy,      3),
        "carbon_batch":     round(carbon,      3),
        "quality_score":    round(quality,     4),
        "reliability_idx":  round(reliability, 4),
        "hardness":         hardness,
        "friability":       friability,
        "dissolution_rate": dissolution_rate,
    }
