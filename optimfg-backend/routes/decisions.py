import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db, Decision
from models.schemas import DecisionCreate, DecisionOut

router = APIRouter(prefix="/decisions", tags=["Decisions"])

@router.post("", response_model=DecisionOut)
def log_decision(payload: DecisionCreate, db: Session = Depends(get_db)):
    decision = Decision(
        batch_id     = payload.batch_id,
        action       = payload.action,
        params_json  = json.dumps(payload.params.model_dump()),
        energy       = payload.energy,
        quality      = payload.quality,
        operator_id  = payload.operator_id,
        comment      = payload.comment,
        weights_json = json.dumps(payload.weights or {}),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision

@router.get("", response_model=List[DecisionOut])
def get_decisions(action: str = None, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(Decision).order_by(Decision.created_at.desc())
    if action:
        query = query.filter(Decision.action == action)
    return query.limit(limit).all()