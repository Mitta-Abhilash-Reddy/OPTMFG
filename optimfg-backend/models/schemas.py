from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Shared parameter block ────────────────────────────────────────────────────

class ProcessParams(BaseModel):
    granulation_time:   float = Field(..., ge=10,  le=30,  description="minutes")
    binder_amount:      float = Field(..., ge=8,   le=18,  description="percent")
    drying_temp:        float = Field(..., ge=150, le=200, description="celsius")
    drying_time:        float = Field(..., ge=30,  le=70,  description="minutes")
    compression_force:  float = Field(..., ge=6,   le=18,  description="kN")
    machine_speed:      float = Field(..., ge=80,  le=140, description="rpm")
    lubricant_conc:     float = Field(..., ge=0.2, le=1.5, description="percent")
    moisture_content:   float = Field(..., ge=4,   le=9,   description="percent")


# ── Predict ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    params: ProcessParams

class PredictResponse(BaseModel):
    energy_batch:    float
    carbon_batch:    float
    quality_score:   float
    reliability_idx: float
    hardness:        float
    friability:      float
    dissolution_rate: float


# ── Optimize ──────────────────────────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    mode: str = Field("balanced", description="balanced | energy_saver | quality_max")
    quality_min: float = Field(0.90, description="Minimum acceptable quality score")
    energy_max:  float = Field(160.0, description="Maximum acceptable energy kWh/batch")
    pop_size:    int   = Field(80,  ge=20,  le=200)
    n_gen:       int   = Field(60,  ge=10,  le=200)

class ParetoSolution(BaseModel):
    solution_id:      int
    granulation_time: float
    binder_amount:    float
    drying_temp:      float
    drying_time:      float
    compression_force: float
    machine_speed:    float
    lubricant_conc:   float
    moisture_content: float
    energy_batch:     float
    carbon_batch:     float
    quality_score:    float
    reliability_idx:  float

class OptimizeResponse(BaseModel):
    mode:             str
    pareto_solutions: List[ParetoSolution]
    recommended:      ParetoSolution       # single best pick for the chosen mode
    n_solutions:      int


# ── Golden Signature ──────────────────────────────────────────────────────────

class GoldenSignatureCreate(BaseModel):
    params:  ProcessParams
    outcomes: PredictResponse
    source:  str = "optimized"

class GoldenSignatureOut(BaseModel):
    id:               int
    version:          str
    granulation_time: float
    binder_amount:    float
    drying_temp:      float
    drying_time:      float
    compression_force: float
    machine_speed:    float
    lubricant_conc:   float
    moisture_content: float
    energy_batch:     float
    carbon_batch:     float
    quality_score:    float
    reliability_idx:  float
    source:           str
    is_active:        bool
    created_at:       datetime

    class Config:
        from_attributes = True


# ── Decisions ─────────────────────────────────────────────────────────────────

class DecisionCreate(BaseModel):
    batch_id:    str
    action:      str   = Field(..., pattern="^(accepted|rejected|modified)$")
    params:      ProcessParams
    energy:      float
    quality:     float
    operator_id: str
    comment:     Optional[str] = ""
    weights:     Optional[dict] = {"energy": 1.0, "quality": 1.0, "carbon": 1.0}

class DecisionOut(BaseModel):
    id:          int
    batch_id:    str
    action:      str
    params_json: str
    energy:      float
    quality:     float
    operator_id: str
    comment:     Optional[str]
    created_at:  datetime

    class Config:
        from_attributes = True
