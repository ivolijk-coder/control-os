from fastapi import APIRouter

from app.schemas.dashboard import DashboardStat, DashboardSummary

router = APIRouter()

# Espelha apps/web/lib/mock-data.ts::MOCK_STATS. Fase 1: dados estáticos,
# apenas para validar o contrato de resposta do Dashboard Vivo™.
_MOCK_STATS = [
    DashboardStat(id="st_missoes", label="Missões ativas", value="12", delta="+3 esta semana", trend="up", accent="purple"),
    DashboardStat(id="st_execucoes", label="Execuções invisíveis", value="47", delta="+18%", trend="up", accent="green"),
    DashboardStat(id="st_pendencias", label="Pendências críticas", value="2", delta="-1 desde ontem", trend="down", accent="red"),
    DashboardStat(id="st_receita", label="Receita do mês", value="R$ 84.200", delta="+9,4%", trend="up", accent="blue"),
]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary() -> DashboardSummary:
    return DashboardSummary(stats=_MOCK_STATS)
