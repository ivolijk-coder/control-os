import uuid
from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.user import UserRead

router = APIRouter()

# Espelha apps/web/lib/mock-data.ts::MOCK_USER. Fase 2 substitui isto por
# uma consulta autenticada via app.db.session.get_db.
_MOCK_USER = UserRead(
    id=uuid.uuid5(uuid.NAMESPACE_DNS, "ivolijk@gmail.com"),
    name="Ivoli Jr",
    email="ivolijk@gmail.com",
    role="Fundador",
    company="Control Marketing",
    plan="pro",
    created_at=datetime(2025, 11, 2, 10, 0, tzinfo=timezone.utc),
)


@router.get("/me", response_model=UserRead)
def get_current_user() -> UserRead:
    return _MOCK_USER
