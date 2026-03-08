# OptiMFG ⚡
### AI-Driven Manufacturing Intelligence Platform
**Adaptive Multi-Objective Optimization of Industrial Batch Process and Energy Pattern Analytics**

> IIT Hyderabad Hackathon (AVEVA) | v0.1.0

---

## What is OptiMFG?

OptiMFG is a full-stack AI platform that optimizes pharmaceutical manufacturing batch processes by simultaneously balancing energy consumption, carbon emissions, product quality, and machine reliability. It uses **NSGA-II multi-objective optimization** with **ML surrogate models** to find Pareto-optimal manufacturing parameters.

---

## Project Structure

```
project_Base_model/
├── optimfg-backend/          # FastAPI backend (Python)
│   ├── main.py               # App entry point
│   ├── core/
│   │   ├── simulator.py      # ML surrogate model (swap with real models here)
│   │   └── optimizer.py      # NSGA-II optimization engine (pymoo)
│   ├── routes/
│   │   ├── predict.py        # POST /predict
│   │   ├── optimize.py       # POST /optimize
│   │   ├── golden_signature.py # GET/POST /golden-signatures
│   │   └── decisions.py      # GET/POST /decisions
│   ├── db/
│   │   └── database.py       # SQLite + SQLAlchemy ORM
│   ├── models/
│   │   └── schemas.py        # Pydantic schemas
│   ├── .env                  # Environment variables
│   └── requirements.txt
│
└── optimfg-dashboard/        # React frontend (Vite)
    └── src/
        └── App.jsx           # Full dashboard (all 5 views)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Recharts |
| Backend | Python 3.13 + FastAPI |
| Database | SQLite (prototype) → PostgreSQL (production) |
| Optimization | pymoo (NSGA-II) |
| ML Models | XGBoost + scikit-learn (mock → swap real) |
| Validation | Pydantic 2.9 |

---

## Quick Start

### Backend
```bash
cd optimfg-backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

### Frontend
```bash
cd optimfg-dashboard
npm install
npm run dev
# Dashboard → http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Predict batch KPIs from process parameters |
| POST | `/optimize` | Run NSGA-II, returns Pareto-optimal solutions |
| GET | `/golden-signatures` | List all golden signatures |
| POST | `/golden-signatures/update` | Add candidate (dominance check) |
| PATCH | `/golden-signatures/{id}/activate` | Set active signature |
| POST | `/decisions` | Log operator decision |
| GET | `/decisions` | Get decision history |

---

## Dashboard Views

| View | Description |
|------|-------------|
| **Overview** | Live prediction, KPI cards, energy trend, radar vs golden signature |
| **Optimization** | Run NSGA-II, Pareto front chart, solutions table, promote to golden |
| **Golden Signatures** | Versioned optimal configs, activate/archive, comparison chart |
| **Decisions** | Log operator accept/reject/modify, preference weights, history |
| **Asset Health** | Vibration RMS, anomaly score trend, power consumption monitoring |

---

## Swapping in Real ML Models

The mock simulator is in `core/simulator.py`. Replace it with your trained models:

```python
# 1. Save your models
import joblib
joblib.dump(model_E, 'models/saved/model_E.joblib')  # predicts energy_batch
joblib.dump(model_Q, 'models/saved/model_Q.joblib')  # predicts quality_score
joblib.dump(model_V, 'models/saved/model_V.joblib')  # predicts reliability_idx

# 2. Replace predict_all() in core/simulator.py
import joblib, pandas as pd
_model_E = joblib.load('models/saved/model_E.joblib')
_model_Q = joblib.load('models/saved/model_Q.joblib')
_model_V = joblib.load('models/saved/model_V.joblib')

def predict_all(params: dict) -> dict:
    row = pd.DataFrame([params])
    energy  = float(_model_E.predict(row)[0])
    quality = float(_model_Q.predict(row)[0])
    reliab  = float(_model_V.predict(row)[0])
    carbon  = round(energy * 0.7, 3)
    return {
        'energy_batch': round(energy, 3), 'carbon_batch': carbon,
        'quality_score': round(quality, 4), 'reliability_idx': round(reliab, 4),
        'hardness': round(6 + quality * 6, 2),
        'friability': round((1 - quality) * 2, 3),
        'dissolution_rate': round(quality * 95, 1),
    }

# 3. Restart server — everything else is automatic
```

---

## Environment Variables

```env
DATABASE_URL=sqlite:///./optimfg.db
EMISSION_FACTOR=0.7    # kg CO2 per kWh
```

---

## Team

| Role | Work Done |
|------|-----------|
| **Full Stack** | FastAPI backend, React dashboard, DB schema, API integration |
| **ML Team** | XGBoost surrogate models, NSGA-II problem formulation, data pipeline |

---

## License
Built for IIT Hyderabad Hackathon (AVEVA). Educational use.
