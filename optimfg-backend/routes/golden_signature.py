import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db, GoldenSignature
from models.schemas import GoldenSignatureCreate, GoldenSignatureOut

router = APIRouter(prefix="/golden-signatures", tags=["Golden Signatures"])


def _next_version(db: Session) -> str:
    count = db.query(GoldenSignature).count()
    return f"v{count + 1}"


def _dominates(a: dict, b: dict) -> bool:
    """Return True if solution `a` dominates solution `b`."""
    better_on_one = False
    for key in ("energy_batch", "carbon_batch"):       # minimise
        if a[key] > b[key]:
            return False
        if a[key] < b[key]:
            better_on_one = True
    for key in ("quality_score", "reliability_idx"):   # maximise
        if a[key] < b[key]:
            return False
        if a[key] > b[key]:
            better_on_one = True
    return better_on_one


@router.get("", response_model=List[GoldenSignatureOut])
def list_signatures(db: Session = Depends(get_db)):
    """Return all golden signatures ordered by creation date descending."""
    return db.query(GoldenSignature).order_by(GoldenSignature.created_at.desc()).all()


@router.get("/active", response_model=GoldenSignatureOut)
def get_active(db: Session = Depends(get_db)):
    sig = db.query(GoldenSignature).filter(GoldenSignature.is_active == True).first()
    if not sig:
        raise HTTPException(status_code=404, detail="No active golden signature found.")
    return sig


@router.post("/update", response_model=dict)
def update_signatures(payload: GoldenSignatureCreate, db: Session = Depends(get_db)):
    """
    Dominance-based update:
    - If new candidate is dominated by an existing signature → discard.
    - If new candidate dominates existing ones → remove them and insert.
    - If non-dominated and different trade-off → insert alongside.
    """
    params   = payload.params.model_dump()
    outcomes = payload.outcomes.model_dump()

    candidate = {**params, **outcomes}

    existing = db.query(GoldenSignature).all()

    dominated_ids   = []
    is_dominated    = False

    for sig in existing:
        sig_dict = {
            "granulation_time":   sig.granulation_time,
            "binder_amount":      sig.binder_amount,
            "drying_temp":        sig.drying_temp,
            "drying_time":        sig.drying_time,
            "compression_force":  sig.compression_force,
            "machine_speed":      sig.machine_speed,
            "lubricant_conc":     sig.lubricant_conc,
            "moisture_content":   sig.moisture_content,
            "energy_batch":       sig.energy_batch,
            "carbon_batch":       sig.carbon_batch,
            "quality_score":      sig.quality_score,
            "reliability_idx":    sig.reliability_idx,
        }
        if _dominates(sig_dict, candidate):
            is_dominated = True
            break
        if _dominates(candidate, sig_dict):
            dominated_ids.append(sig.id)

    if is_dominated:
        return {"added": False, "removed": [], "reason": "Candidate is dominated by existing signature."}

    # Remove dominated signatures
    for sig_id in dominated_ids:
        db.query(GoldenSignature).filter(GoldenSignature.id == sig_id).delete()

    # Insert new signature
    new_sig = GoldenSignature(
        version           = _next_version(db),
        granulation_time  = params["granulation_time"],
        binder_amount     = params["binder_amount"],
        drying_temp       = params["drying_temp"],
        drying_time       = params["drying_time"],
        compression_force = params["compression_force"],
        machine_speed     = params["machine_speed"],
        lubricant_conc    = params["lubricant_conc"],
        moisture_content  = params["moisture_content"],
        energy_batch      = outcomes["energy_batch"],
        carbon_batch      = outcomes["carbon_batch"],
        quality_score     = outcomes["quality_score"],
        reliability_idx   = outcomes["reliability_idx"],
        source            = payload.source,
        is_active         = len(existing) == 0,   # first signature is auto-active
    )
    db.add(new_sig)
    db.commit()
    db.refresh(new_sig)

    return {
        "added":   True,
        "new_id":  new_sig.id,
        "version": new_sig.version,
        "removed": dominated_ids,
        "reason":  "Candidate added to golden set.",
    }


@router.patch("/{sig_id}/activate", response_model=dict)
def activate_signature(sig_id: int, db: Session = Depends(get_db)):
    """Set a specific signature as the active one."""
    db.query(GoldenSignature).update({"is_active": False})
    sig = db.query(GoldenSignature).filter(GoldenSignature.id == sig_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found.")
    sig.is_active = True
    db.commit()
    return {"activated": sig_id, "version": sig.version}
