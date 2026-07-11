from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()

# Fase 1: não há tabela `users` consultada aqui ainda. Isso existe para que
# o contrato de API (rota, payload, resposta) já esteja definido e estável
# antes da Fase 2 trocar o corpo da função por uma consulta real ao
# PostgreSQL via app.db.session.get_db.


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    if not payload.email or not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credenciais inválidas.")

    token = create_access_token(subject=payload.email)
    return TokenResponse(access_token=token)
