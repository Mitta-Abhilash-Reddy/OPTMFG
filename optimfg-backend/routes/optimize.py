from fastapi import APIRouter, HTTPException
from models.schemas import OptimizeRequest, OptimizeResponse, ParetoSolution
from core.optimizer import run_optimization, pick_recommended

router = APIRouter(prefix="/optimize", tags=["Optimization"])

@router.post("", response_model=OptimizeResponse)
def optimize(request: OptimizeRequest):
    solutions = run_optimization(
        mode        = request.mode,
        quality_min = request.quality_min,
        energy_max  = request.energy_max,
        pop_size    = request.pop_size,
        n_gen       = request.n_gen,
    )
    if not solutions:
        raise HTTPException(status_code=422, detail="No feasible solutions found.")
    recommended = pick_recommended(solutions, request.mode)
    return OptimizeResponse(
        mode             = request.mode,
        pareto_solutions = [ParetoSolution(**s) for s in solutions],
        recommended      = ParetoSolution(**recommended),
        n_solutions      = len(solutions),
    )