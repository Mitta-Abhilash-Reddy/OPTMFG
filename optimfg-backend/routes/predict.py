from fastapi import APIRouter
from models.schemas import PredictRequest, PredictResponse
from core.simulator import predict_all

router = APIRouter(prefix="/predict", tags=["Prediction"])

@router.post("", response_model=PredictResponse)
def predict(request: PredictRequest):
    params = request.params.model_dump()
    result = predict_all(params)
    return PredictResponse(**result)