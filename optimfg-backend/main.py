from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

sys.path.append(os.path.dirname(__file__))

from db.database import init_db
from routes import predict, optimize, golden_signature, decisions

app = FastAPI(
    title="OptiMFG API",
    description="AI-Driven Manufacturing Intelligence — Adaptive Multi-Objective Optimization",
    version="0.1.0",
)

# ── CORS (allow React dev server) ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ── Create DB tables on startup ───────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()
    print("✅ Database tables ready.")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(predict.router)
app.include_router(optimize.router)
app.include_router(golden_signature.router)
app.include_router(decisions.router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "project": "OptiMFG",
        "docs": "/docs",
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
